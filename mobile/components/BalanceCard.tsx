import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { palette, radii, shadows, spacing } from "../constants/theme"

type Props = {
  title: string
  value: string
  subtitle?: string
  status?: "synced" | "pending" | "error"
}

export const BalanceCard: React.FC<Props> = ({ title, value, subtitle, status = "synced" }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <StatusPill status={status} />
      </View>
      <Text style={styles.value}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const StatusPill: React.FC<{ status: "synced" | "pending" | "error" }> = ({ status }) => {
  const label = status === "synced" ? "SYNCED" : status === "pending" ? "PENDING" : "ERROR"
  const background =
    status === "synced" ? "rgba(62,214,181,0.12)" : status === "pending" ? "rgba(249,168,37,0.12)" : "rgba(243,101,107,0.12)"
  const color = status === "synced" ? palette.accent : status === "pending" ? palette.warning : palette.danger
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.sm,
    ...shadows.card
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  title: {
    color: palette.muted,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  value: {
    color: palette.text,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: palette.muted,
    fontSize: 12
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700"
  }
})
