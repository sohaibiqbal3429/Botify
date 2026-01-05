import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { palette, radii, spacing } from "../constants/theme"

type Props = {
  title: string
  subtitle?: string
  amount: string
  status?: string
  timestamp?: string
}

export const TransactionItem: React.FC<Props> = ({ title, subtitle, amount, status, timestamp }) => {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.amount}>{amount}</Text>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.cardAlt,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  title: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 16
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13
  },
  timestamp: {
    color: palette.muted,
    fontSize: 12
  },
  meta: {
    alignItems: "flex-end",
    gap: spacing.xs
  },
  amount: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700"
  },
  status: {
    color: palette.accent,
    fontSize: 12,
    letterSpacing: 0.2
  }
})
