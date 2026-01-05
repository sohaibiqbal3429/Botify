import React, { useState } from "react"
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Link } from "expo-router"
import { Button } from "../components/Button"
import { palette, radii, spacing } from "../constants/theme"
import { useAuth } from "../hooks/useAuth"
import { getErrorPayload } from "../services/api"

export default function RegisterScreen() {
  const { registerUser, requestOtp, verifyOtpCode } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [otp, setOtp] = useState("")
  const [otpRequested, setOtpRequested] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSendOtp = async () => {
    try {
      setLoading(true)
      const devOtp = await requestOtp({ email, phone, purpose: "registration" })
      setOtpRequested(true)
      if (devOtp) setOtp(devOtp)
      Alert.alert("Verification", "OTP sent. Check your inbox.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("OTP failed", payload.message || "Unable to send code.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      if (otpRequested) {
        await verifyOtpCode({ code: otp, email, phone, purpose: "registration" })
      }
      await registerUser({ name, email, phone, password, referralCode })
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Registration failed", payload.message || "Please verify your details.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Complete your details to secure your referral perks and wallet access.</Text>

        <Input label="Name" value={name} onChangeText={setName} placeholder="Enter name" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="Enter email" keyboardType="email-address" />
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+15551234567" keyboardType="phone-pad" />
        <Input label="Password" value={password} onChangeText={setPassword} placeholder="Enter password" secureTextEntry />
        <Input label="Referral Code" value={referralCode} onChangeText={setReferralCode} placeholder="Enter referral code" />

        <View style={styles.row}>
          <Input label="OTP Code" value={otp} onChangeText={setOtp} placeholder="123456" keyboardType="number-pad" containerStyle={{ flex: 1 }} />
          <Button label="Send OTP" onPress={handleSendOtp} loading={loading} variant="ghost" />
        </View>

        <Button
          label="Create Account"
          onPress={handleSubmit}
          loading={loading}
          disabled={!name || !email || !phone || !password || !referralCode}
        />

        <Link href="/login" style={styles.link}>
          Already have an account? Login
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

type InputProps = React.ComponentProps<typeof TextInput> & { label: string; containerStyle?: object }
const Input: React.FC<InputProps> = ({ label, containerStyle, ...props }) => (
  <View style={[styles.field, containerStyle]}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      placeholderTextColor={palette.muted}
      autoCapitalize="none"
      {...props}
    />
  </View>
)

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
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-end"
  },
  link: {
    color: palette.accent,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing.md
  }
})
