import React, { useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Button } from "../components/Button"
import { palette, radii, spacing } from "../constants/theme"
import { submitWithdraw } from "../services/auth"
import { getErrorPayload } from "../services/api"

export default function WithdrawScreen() {
  const [amount, setAmount] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const [source, setSource] = useState<"main" | "earnings">("main")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      await submitWithdraw({ amount: Number(amount), walletAddress, source })
      Alert.alert("Submitted", "Withdrawal request sent. You will be notified when processed.")
      setAmount("")
      setWalletAddress("")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Withdraw failed", payload.message || "Please check your details.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cash Out</Text>
      <Text style={styles.subtitle}>Withdraw funds securely with validation and sync status.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Request withdrawal</Text>
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
          <Text style={styles.label}>Destination address</Text>
          <TextInput
            style={styles.input}
            placeholder="Wallet address"
            placeholderTextColor={palette.muted}
            value={walletAddress}
            onChangeText={setWalletAddress}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.row}>
          <Button label="Main Wallet" variant={source === "main" ? "primary" : "ghost"} onPress={() => setSource("main")} />
          <Button label="Earnings" variant={source === "earnings" ? "primary" : "ghost"} onPress={() => setSource("earnings")} />
        </View>
        <Button label="Submit request" onPress={handleSubmit} loading={loading} disabled={!amount || !walletAddress} />
        <Text style={styles.hint}>Min/Max limits and duplicate submissions are enforced by the backend.</Text>
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
    gap: spacing.md
  },
  sectionTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 18
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
    backgroundColor: palette.cardAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    color: palette.text
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm
  },
  hint: {
    color: palette.muted,
    fontSize: 12
  }
})
