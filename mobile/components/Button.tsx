import React from "react"
import { ActivityIndicator, GestureResponderEvent, Pressable, StyleSheet, Text } from "react-native"
import { palette, radii, spacing } from "../constants/theme"

type Props = {
  label: string
  onPress?: (event: GestureResponderEvent) => void
  disabled?: boolean
  loading?: boolean
  variant?: "primary" | "ghost" | "danger"
}

export const Button: React.FC<Props> = ({ label, onPress, disabled, loading, variant = "primary" }) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  label: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 16
  },
  primary: {
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 6
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: palette.border
  },
  danger: {
    backgroundColor: palette.danger
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }]
  }
})
