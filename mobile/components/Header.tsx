import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { palette, spacing } from "../constants/theme"
import { Button } from "./Button"
import { useAuth } from "../hooks/useAuth"

type Props = {
  title: string
  subtitle?: string
  showLogout?: boolean
}

export const Header: React.FC<Props> = ({ title, subtitle, showLogout }) => {
  const { logout, user } = useAuth()

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {user ? <Text style={styles.userMeta}>{user.email}</Text> : null}
      </View>
      {showLogout ? <Button label="Sign out" variant="ghost" onPress={logout} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.text
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14
  },
  userMeta: {
    color: palette.muted,
    fontSize: 12,
    letterSpacing: 0.2
  }
})
