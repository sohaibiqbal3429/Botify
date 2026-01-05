import React, { useState } from "react"
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Button } from "../components/Button"
import { palette, radii, spacing } from "../constants/theme"
import { useAuth } from "../hooks/useAuth"
import { getErrorPayload } from "../services/api"

export default function ForgotPasswordScreen() {
  const { requestOtp, resetPasswordWithCode } = useAuth()
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    try {
      setLoading(true)
      await requestOtp({ email, purpose: "password_reset" })
      setSent(true)
      Alert.alert("OTP sent", "Check your inbox for the reset code.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Error", payload.message || "Unable to send OTP.")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    try {
      setLoading(true)
      await resetPasswordWithCode({ email, password, otpCode: otp })
      Alert.alert("Password updated", "You can now sign in with your new password.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Reset failed", payload.message || "Please verify your code.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Send a verification code to your email, then set a new password.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="name@company.com"
            placeholderTextColor={palette.muted}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
        </View>

        <Button label="Send code" onPress={handleSend} loading={loading} disabled={!email} />

        <View style={[styles.field, { marginTop: spacing.md }]}>
          <Text style={styles.label}>OTP Code</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor={palette.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Button label="Update password" onPress={handleReset} loading={loading} disabled={!sent || !otp || !password} />
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
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: palette.muted
  },
  field: {
    gap: spacing.xs
  },
  label: {
    color: palette.muted,
    fontSize: 13,
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
