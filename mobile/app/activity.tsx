import React, { useEffect, useState } from "react"
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { TransactionItem } from "../components/TransactionItem"
import { Loading } from "../components/Loading"
import { palette, spacing } from "../constants/theme"
import { fetchActivity } from "../services/auth"
import { getErrorPayload } from "../services/api"

export default function ActivityScreen() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const response = await fetchActivity(1, 50)
      setItems(response.data || [])
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Activity error", payload.message || "Unable to load activity.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <Text style={styles.title}>Activity Timeline</Text>
      <Text style={styles.subtitle}>Chronological events with statuses and timestamps.</Text>

      {loading ? <Loading message="Loading activity..." /> : null}

      <View style={{ gap: spacing.sm }}>
        {items.map((item) => (
          <TransactionItem
            key={item._id}
            title={item.type || "Transaction"}
            subtitle={item.description || item.title}
            amount={`$${item.amount ?? 0}`}
            status={item.status}
            timestamp={item.createdAt ? new Date(item.createdAt).toLocaleString() : undefined}
          />
        ))}
        {items.length === 0 && !loading ? <Text style={{ color: palette.muted }}>No activity yet.</Text> : null}
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
  }
})
