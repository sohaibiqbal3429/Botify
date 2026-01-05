import React from "react"
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer"
import { StyleSheet, Text, View } from "react-native"
import { Link } from "expo-router"
import { palette, radii, spacing } from "../constants/theme"
import { useAuth } from "../hooks/useAuth"

const links = [
  { label: "Overview", href: "/dashboard", icon: "🏠" },
  { label: "Top-Up Center", href: "/deposit", icon: "➕" },
  { label: "Cash Out", href: "/withdraw", icon: "💸" },
  { label: "Network Crew", href: "/referrals", icon: "👥" },
  { label: "Wallet Hub", href: "/wallet", icon: "👛" },
  { label: "Activity Timeline", href: "/activity", icon: "📜" },
  { label: "Account Center", href: "/profile", icon: "👤" },
  { label: "Tasks", href: "/tasks", icon: "🧠" },
  { label: "Knowledge Base", href: "/support", icon: "📚" }
]

export const DrawerContent = (props: any) => {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === "admin"

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0] || "U"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.name || "Member"}</Text>
          <Text style={styles.meta}>{user?.email}</Text>
          <Text style={styles.meta}>{user?.role ?? "user"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        {links.map((item) => (
          <DrawerItem
            key={item.href}
            label={() => (
              <Link href={item.href} style={styles.linkText}>
                {item.icon} {item.label}
              </Link>
            )}
            onPress={() => props.navigation.navigate(item.href as never)}
            style={styles.link}
          />
        ))}
        {isAdmin ? (
          <DrawerItem
            label={() => (
              <Link href="/admin" style={styles.linkText}>
                🛠 Admin Panel
              </Link>
            )}
            onPress={() => props.navigation.navigate("admin" as never)}
            style={styles.link}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <DrawerItem label="Sign out" onPress={logout} labelStyle={styles.logout} />
      </View>
    </DrawerContentScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    paddingVertical: spacing.lg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: palette.text,
    fontWeight: "800",
    fontSize: 18
  },
  name: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 16
  },
  meta: {
    color: palette.muted,
    fontSize: 12
  },
  section: {
    borderTopWidth: 1,
    borderColor: palette.border,
    marginTop: spacing.lg,
    paddingTop: spacing.md
  },
  link: {
    borderRadius: radii.md,
    marginHorizontal: spacing.sm
  },
  linkText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "600"
  },
  logout: {
    color: palette.danger,
    fontWeight: "700"
  }
})
