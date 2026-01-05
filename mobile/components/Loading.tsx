import React from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { palette, spacing } from "../constants/theme"

export const Loading: React.FC<{ message?: string }> = ({ message = "Loading..." }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={palette.accent} />
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  text: {
    color: palette.text,
    fontWeight: "600"
  }
})
