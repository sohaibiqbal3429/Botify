import React, { useEffect, useState } from "react"
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { Redirect, router } from "expo-router"
import { BalanceCard } from "../components/BalanceCard"
import { Button } from "../components/Button"
import { Loading } from "../components/Loading"
import { palette, spacing } from "../constants/theme"
import { fetchWalletBalance, fetchWithdrawHistory } from "../services/auth"
import { getErrorPayload } from "../services/api"
import { TransactionItem } from "../components/TransactionItem"
import { useAuth } from "../hooks/useAuth"

export default function WalletScreen() {
  const { user, loading: authLoading } = useAuth()
  const [wallet, setWallet] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [balanceResponse, historyResponse] = await Promise.all([fetchWalletBalance(), fetchWithdrawHistory(1, 20)])
      setWallet(balanceResponse)
      setHistory(historyResponse.withdrawals || [])
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Wallet error", payload.message || "Unable to load wallet.")
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

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number") return "$0.00"
    return `$${value.toFixed(2)}`
  }

  if (!user && !authLoading) {
    return <Redirect href="/login" />
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <Text style={styles.title}>Wallet Hub</Text>
      <Text style={styles.subtitle}>Balances, deposits, withdrawals, and sync status.</Text>

      {loading ? <Loading message="Syncing wallet..." /> : null}

      <View style={styles.grid}>
        <BalanceCard title="Current Balance" value={formatCurrency(wallet?.balance?.current)} />
        <BalanceCard title="Total Earned" value={formatCurrency(wallet?.balance?.totalEarning)} subtitle="Lifetime earnings" />
        <BalanceCard title="Total Deposits" value={formatCurrency(wallet?.userStats?.depositTotal)} subtitle="Funding across all time" />
        <BalanceCard title="Total Withdrawals" value={formatCurrency(wallet?.userStats?.withdrawTotal)} subtitle="Cash outs across all time" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Withdrawals</Text>
        <View style={{ gap: spacing.sm }}>
          {history.map((item) => (
            <TransactionItem
              key={item._id}
              title={`Withdrawal ${item._id.slice(-6)}`}
              subtitle={`Amount: ${formatCurrency(item.amount)}`}
              amount={formatCurrency(item.amount)}
              status={item.status}
              timestamp={new Date(item.createdAt).toLocaleString()}
            />
          ))}
          {history.length === 0 && !loading ? <Text style={{ color: palette.muted }}>No withdrawals yet.</Text> : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Top-Up Center" onPress={() => router.push("/deposit")} />
        <Button label="Cash Out" variant="ghost" onPress={() => router.push("/withdraw")} />
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
  grid: {
    gap: spacing.md
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 18
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md
  }
})
