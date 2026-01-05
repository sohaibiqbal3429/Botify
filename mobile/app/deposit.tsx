import React, { useEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import QRCode from "react-native-qrcode-svg"
import * as Clipboard from "expo-clipboard"
import { Button } from "../components/Button"
import { Loading } from "../components/Loading"
import { palette, radii, spacing } from "../constants/theme"
import { fetchDepositAddress, submitDeposit } from "../services/auth"
import { getErrorPayload } from "../services/api"

export default function DepositScreen() {
  const [address, setAddress] = useState<string>("")
  const [network, setNetwork] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [txHash, setTxHash] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const response = await fetchDepositAddress()
      setAddress(response.address)
      setNetwork(response.network || response.wallets?.[0]?.network || "USDT-TRC20")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Deposit error", payload.message || "Unable to fetch deposit address.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCopy = async () => {
    await Clipboard.setStringAsync(address)
    Alert.alert("Copied", "Deposit address copied to clipboard.")
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      await submitDeposit({ amount: Number(amount), txHash, network })
      Alert.alert("Submitted", "Deposit submitted for confirmation.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Error", payload.message || "Unable to submit deposit.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Top-Up Center</Text>
      <Text style={styles.subtitle}>Generate deposit address, scan QR, and submit proof for sync.</Text>

      {loading ? <Loading message="Fetching deposit details..." /> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Network</Text>
        <Text style={styles.value}>{network}</Text>
        <Text style={styles.label}>Address</Text>
        <Text selectable style={styles.address}>
          {address || "No address available"}
        </Text>
        {address ? <QRCode value={address} size={160} backgroundColor="transparent" color={palette.text} /> : null}
        <Button label="Copy address" onPress={handleCopy} variant="ghost" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Submit deposit</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Amount (USD)</Text>
          <TextInput
            style={styles.input}
            placeholder="100.00"
            placeholderTextColor={palette.muted}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Transaction Hash</Text>
          <TextInput
            style={styles.input}
            placeholder="Paste TX hash"
            placeholderTextColor={palette.muted}
            value={txHash}
            onChangeText={setTxHash}
          />
        </View>
        <Button label="Submit" onPress={handleSubmit} loading={submitting} disabled={!amount || !txHash} />
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
  card: {
    backgroundColor: palette.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "flex-start"
  },
  label: {
    color: palette.muted,
    fontSize: 12,
    letterSpacing: 0.3
  },
  value: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 16
  },
  address: {
    color: palette.text,
    fontFamily: "monospace"
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 18
  },
  field: {
    gap: spacing.xs,
    alignSelf: "stretch"
  },
  input: {
    backgroundColor: palette.cardAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    color: palette.text
  }
})
