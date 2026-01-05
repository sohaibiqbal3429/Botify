import React, { useEffect, useState } from "react"
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { Button } from "../../components/Button"
import { Loading } from "../../components/Loading"
import { palette, radii, spacing } from "../../constants/theme"
import { useAuth } from "../../hooks/useAuth"
import { fetchAdminSummary, fetchAdminTransactions, fetchAdminUsers } from "../../services/auth"
import { getErrorPayload } from "../../services/api"
import { TransactionItem } from "../../components/TransactionItem"

export default function AdminScreen() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [users, setUsers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const isAdmin = user?.role === "admin"

  const load = async () => {
    if (!isAdmin) return
    try {
      setLoading(true)
      const [summaryResponse, usersResponse, transactionsResponse] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminUsers(1, 10),
        fetchAdminTransactions(1, 10)
      ])
      setSummary(summaryResponse.stats || {})
      setUsers(usersResponse.users || [])
      setTransactions(transactionsResponse.transactions || [])
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Admin error", payload.message || "Unable to load admin data.")
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

  if (!isAdmin) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>Admin access only.</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <Text style={styles.title}>Admin Panel</Text>
      <Text style={styles.subtitle}>Monitor users, transactions, and platform health.</Text>

      {loading ? <Loading message="Loading admin data..." /> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Stats</Text>
        {Object.entries(summary).map(([key, value]) => (
          <View style={styles.row} key={key}>
            <Text style={styles.meta}>{key}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recent Users</Text>
        {users.map((u) => (
          <View key={u._id} style={styles.row}>
            <View>
              <Text style={styles.value}>{u.name || "User"}</Text>
              <Text style={styles.meta}>{u.email}</Text>
            </View>
            <Text style={styles.meta}>{u.role}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <View style={{ gap: spacing.sm }}>
          {transactions.map((tx) => (
            <TransactionItem
              key={tx._id}
              title={tx.type || "Transaction"}
              subtitle={tx.user?.email}
              amount={`$${tx.amount ?? 0}`}
              status={tx.status}
              timestamp={tx.createdAt ? new Date(tx.createdAt).toLocaleString() : undefined}
            />
          ))}
        </View>
      </View>

      <Button label="Refresh" onPress={load} />
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
  blocked: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background
  },
  blockedText: {
    color: palette.danger,
    fontSize: 18,
    fontWeight: "700"
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 18
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  meta: {
    color: palette.muted
  },
  value: {
    color: palette.text,
    fontWeight: "700"
  }
})
