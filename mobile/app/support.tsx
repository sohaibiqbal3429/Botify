import React, { useEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Button } from "../components/Button"
import { Loading } from "../components/Loading"
import { palette, radii, spacing } from "../constants/theme"
import { fetchFaq, fetchTickets, submitTicket } from "../services/auth"
import { getErrorPayload } from "../services/api"

export default function SupportScreen() {
  const [faq, setFaq] = useState<{ question: string; answer: string }[]>([])
  const [tickets, setTickets] = useState<{ _id: string; subject: string; status: string; createdAt: string }[]>([])
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const faqResponse = await fetchFaq()
      const ticketResponse = await fetchTickets()
      setFaq(faqResponse.faqs || [])
      setTickets(ticketResponse.tickets || [])
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Support load failed", payload.message || "Unable to load support content.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      await submitTicket({ subject, message })
      setSubject("")
      setMessage("")
      await load()
      Alert.alert("Submitted", "Support ticket created.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Error", payload.message || "Unable to submit ticket.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Knowledge Base</Text>
      <Text style={styles.subtitle}>Quick answers and support tickets.</Text>

      {loading ? <Loading message="Loading support content..." /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FAQs</Text>
        {faq.map((item) => (
          <View key={item.question} style={styles.card}>
            <Text style={styles.cardTitle}>{item.question}</Text>
            <Text style={styles.cardBody}>{item.answer}</Text>
          </View>
        ))}
        {faq.length === 0 && !loading ? <Text style={styles.cardBody}>No FAQs available yet.</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Tickets</Text>
        {tickets.map((t) => (
          <View key={t._id} style={styles.card}>
            <Text style={styles.cardTitle}>{t.subject}</Text>
            <Text style={styles.cardBody}>Status: {t.status}</Text>
            <Text style={styles.cardBody}>{new Date(t.createdAt).toLocaleString()}</Text>
          </View>
        ))}
        {tickets.length === 0 && !loading ? <Text style={styles.cardBody}>No tickets yet.</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Ticket</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Enter subject"
            placeholderTextColor={palette.muted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue"
            placeholderTextColor={palette.muted}
            multiline
          />
        </View>
        <Button label="Submit" onPress={handleSubmit} loading={submitting} disabled={!subject || !message} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg
  },
  title: {
    color: palette.text,
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: palette.muted
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 18
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.xs
  },
  cardTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 15
  },
  cardBody: {
    color: palette.muted
  },
  field: {
    gap: spacing.xs
  },
  label: {
    color: palette.muted,
    fontSize: 12,
    letterSpacing: 0.3
  },
  input: {
    backgroundColor: palette.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    color: palette.text
  }
})
