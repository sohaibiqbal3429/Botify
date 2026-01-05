import React, { useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { Redirect, router } from "expo-router"
import { BalanceCard } from "../components/BalanceCard"
import { Button } from "../components/Button"
import { Header } from "../components/Header"
import { Loading } from "../components/Loading"
import { palette, spacing } from "../constants/theme"
import { useAuth } from "../hooks/useAuth"
import { fetchDashboard, fetchWalletBalance } from "../services/auth"
import { getErrorPayload } from "../services/api"

export default function DashboardScreen() {
  const { user, refresh, loading: authLoading } = useAuth()
  const [kpis, setKpis] = useState<Record<string, any>>({})
  const [wallet, setWallet] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [dash, balance] = await Promise.all([fetchDashboard(), fetchWalletBalance()])
      setKpis(dash || {})
      setWallet(balance)
    } catch (error) {
      const payload = getErrorPayload(error)
      console.warn("Dashboard load failed", payload)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([load(), refresh()])
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
      <Header title={`Hi, ${user?.name || "User"}`} subtitle={`Role: ${user?.role || "user"}`} showLogout />

      {loading ? <Loading message="Syncing dashboard..." /> : null}

      <View style={styles.grid}>
        <BalanceCard title="Lifetime Yield" value={formatCurrency(kpis?.stats?.lifetimeYield ?? wallet?.balance?.totalEarning)} subtitle="Live feed" status="synced" />
        <BalanceCard title="Vault Balance" value={formatCurrency(wallet?.balance?.totalBalance)} subtitle="All secured funds" status="synced" />
        <BalanceCard title="Withdrawable Balance" value={formatCurrency(wallet?.withdrawableBalance)} subtitle="Ready to cash out" status="synced" />
        <BalanceCard title="Locked Capital" value={formatCurrency(wallet?.balance?.lockedCapital)} subtitle="Currently staked" status="pending" />
      </View>

      <View style={styles.actions}>
        <Button label="Top-Up Center" onPress={() => router.push("/deposit")} />
        <Button label="Cash Out" variant="ghost" onPress={() => router.push("/withdraw")} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Sync</Text>
        <Text style={styles.sectionBody}>Data auto-refreshes every load. Pull to refresh to revalidate network stats.</Text>
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
  grid: {
    gap: spacing.md
  },
  actions: {
    flexDirection: "row",
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
  sectionBody: {
    color: palette.muted
  }
})
