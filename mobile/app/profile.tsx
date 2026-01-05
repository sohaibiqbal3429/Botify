import React, { useEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { Button } from "../components/Button"
import { Loading } from "../components/Loading"
import { palette, radii, spacing } from "../constants/theme"
import { useAuth } from "../hooks/useAuth"
import { getErrorPayload } from "../services/api"
import { changePassword, requestOtp, updateProfile } from "../services/auth"

export default function ProfileScreen() {
  const { user, refresh, logout } = useAuth()
  const [name, setName] = useState(user?.name || "")
  const [avatar, setAvatar] = useState(user?.profileAvatar || "shield")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [otpRequested, setOtpRequested] = useState(false)

  useEffect(() => {
    setName(user?.name || "")
  }, [user])

  const handleUpdateProfile = async () => {
    try {
      setLoading(true)
      await updateProfile({ name, avatar })
      await refresh()
      Alert.alert("Profile updated", "Your profile has been saved.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Error", payload.message || "Failed to update profile.")
    } finally {
      setLoading(false)
    }
  }

  const handleRequestOtp = async () => {
    try {
      setLoading(true)
      await requestOtp({ email: user?.email, purpose: "password_reset" })
      setOtpRequested(true)
      Alert.alert("OTP sent", "Check your email for the 6-digit code.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Error", payload.message || "Failed to send OTP.")
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    try {
      setLoading(true)
      const response = await changePassword({ currentPassword, newPassword, otpCode: otp })
      if (!response.success) {
        throw new Error(response.message || "Failed to update password")
      }
      setCurrentPassword("")
      setNewPassword("")
      setOtp("")
      Alert.alert("Password updated", "Sign in again with your new password.")
    } catch (error) {
      const payload = getErrorPayload(error)
      Alert.alert("Error", payload.message || "Failed to update password.")
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <Loading message="Loading profile..." />
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Account Center</Text>
      <Text style={styles.subtitle}>Manage profile, security, and session.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter name"
            placeholderTextColor={palette.muted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Avatar</Text>
          <TextInput
            style={styles.input}
            value={avatar}
            onChangeText={setAvatar}
            placeholder="shield"
            placeholderTextColor={palette.muted}
          />
        </View>
        <Button label="Save profile" onPress={handleUpdateProfile} loading={loading} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Current password</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Current password"
            placeholderTextColor={palette.muted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="New password"
            placeholderTextColor={palette.muted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>OTP Code</Text>
          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            placeholder="123456"
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
          />
        </View>
        <Button label="Send OTP" variant="ghost" onPress={handleRequestOtp} loading={loading} />
        <Button
          label="Update password"
          onPress={handleChangePassword}
          loading={loading}
          disabled={!otpRequested || !currentPassword || !newPassword || !otp}
        />
      </View>

      <Button label="Sign out" variant="danger" onPress={logout} />
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
  }
})
