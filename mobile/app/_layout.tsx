import "react-native-gesture-handler"
import React from "react"
import { Drawer } from "expo-router/drawer"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { StatusBar } from "expo-status-bar"
import { DrawerContent } from "../components/Drawer"
import { AuthProvider } from "../hooks/useAuth"
import { palette } from "../constants/theme"

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Drawer
          screenOptions={{
            headerShown: false,
            drawerStyle: { backgroundColor: palette.background },
            sceneStyle: { backgroundColor: palette.background }
          }}
          drawerContent={(props) => <DrawerContent {...props} />}
        >
          <Drawer.Screen name="index" options={{ drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="login" options={{ title: "Login", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="register" options={{ title: "Register", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="forgot-password" options={{ title: "Forgot Password", drawerItemStyle: { display: "none" } }} />
          <Drawer.Screen name="dashboard" options={{ title: "Overview" }} />
          <Drawer.Screen name="wallet" options={{ title: "Wallet Hub" }} />
          <Drawer.Screen name="deposit" options={{ title: "Top-Up Center" }} />
          <Drawer.Screen name="withdraw" options={{ title: "Cash Out" }} />
          <Drawer.Screen name="referrals" options={{ title: "Network Crew" }} />
          <Drawer.Screen name="activity" options={{ title: "Activity Timeline" }} />
          <Drawer.Screen name="tasks" options={{ title: "Tasks" }} />
          <Drawer.Screen name="profile" options={{ title: "Account Center" }} />
          <Drawer.Screen name="support" options={{ title: "Knowledge Base" }} />
          <Drawer.Screen name="admin/index" options={{ title: "Admin Panel" }} />
        </Drawer>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
