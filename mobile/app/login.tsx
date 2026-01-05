import React, { useState } from "react"
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Link } from "expo-router"
import { Button } from "../components/Button"
import { palette, radii, spacing } from "../constants/theme"
import { useAuth } from "../hooks/useAuth"
import { getErrorPayload } from "../services/api"

export default function LoginScreen() {
  const { loginWithPassword } = useAuth()
  const [identifier, setIdentifier] = useState("")
  const [identifierType, setIdentifierType] = useState<"email" | "phone">("email")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      await loginWithPassword(identifier.trim(), identifierType, password)
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Login failed", payload.message || "Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Sign in to referrals</Text>
        <Text style={styles.subtitle}>
          Modern, distraction-free login with adaptive security. Enter your email or phone to access your referral dashboard.
        </Text>

        <View style={styles.toggle}>
          <Button
            label="Email"
            variant={identifierType === "email" ? "primary" : "ghost"}
            onPress={() => setIdentifierType("email")}
          />
          <Button
            label="Phone"
            variant={identifierType === "phone" ? "primary" : "ghost"}
            onPress={() => setIdentifierType("phone")}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{identifierType === "email" ? "Email Address" : "Phone (+ country code)"}</Text>
          <TextInput
            placeholder={identifierType === "email" ? "name@company.com" : "+15551234567"}
            placeholderTextColor={palette.muted}
            style={styles.input}
            autoCapitalize="none"
            keyboardType={identifierType === "email" ? "email-address" : "phone-pad"}
            value={identifier}
            onChangeText={setIdentifier}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="Enter your password"
            placeholderTextColor={palette.muted}
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={styles.linksRow}>
          <Link href="/register" style={styles.link}>
            Create Account
          </Link>
          <Link href="/forgot-password" style={styles.link}>
            Forgot Password?
          </Link>
        </View>

        <Button label="Login" onPress={handleSubmit} loading={loading} disabled={!identifier || !password} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15
  },
  toggle: {
    flexDirection: "row",
    gap: spacing.sm
  },
  field: {
    gap: spacing.xs
  },
  label: {
    color: palette.muted,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  input: {
    backgroundColor: palette.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    color: palette.text
  },
  linksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  link: {
    color: palette.accent,
    fontWeight: "700"
  }
})
