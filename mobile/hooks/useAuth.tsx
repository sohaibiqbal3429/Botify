import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { router } from "expo-router"
import {
  changePassword,
  fetchAuthStatus,
  fetchMe,
  login,
  loginWithOtp,
  logout as apiLogout,
  register,
  resetPassword,
  sendOtp,
  verifyOtp
} from "../services/auth"
import { getErrorPayload } from "../services/api"
import { secureStorage } from "../services/storage"
import type { AuthMeResponse } from "../types/api-contracts"

type AuthContextValue = {
  user: AuthMeResponse["user"] | null
  blocked: boolean
  loading: boolean
  refreshing: boolean
  loginWithPassword: (identifier: string, identifierType: "email" | "phone", password: string) => Promise<void>
  loginWithCode: (payload: { email?: string; phone?: string; otpCode: string }) => Promise<void>
  registerUser: (payload: { name: string; email: string; phone: string; password: string; referralCode: string }) => Promise<void>
  requestOtp: (payload: { email?: string; phone?: string; purpose?: "registration" | "login" | "password_reset" }) => Promise<string | undefined>
  verifyOtpCode: (payload: { code: string; email?: string; phone?: string; purpose?: "registration" | "login" | "password_reset" }) => Promise<void>
  resetPasswordWithCode: (payload: { email: string; password: string; otpCode: string }) => Promise<void>
  changePasswordWithCode: (payload: { currentPassword: string; newPassword: string; otpCode: string }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthMeResponse["user"] | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const hydrate = useCallback(async () => {
    setRefreshing(true)
    try {
      const me = await fetchMe()
      setUser(me.user)
      const status = await fetchAuthStatus()
      setBlocked(status.blocked)
    } catch {
      setUser(null)
      setBlocked(false)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const loginWithPassword = useCallback(
    async (identifier: string, identifierType: "email" | "phone", password: string) => {
      await login(identifier, identifierType, password)
      await hydrate()
      router.replace("/dashboard")
    },
    [hydrate]
  )

  const loginWithCode = useCallback(
    async (payload: { email?: string; phone?: string; otpCode: string }) => {
      await loginWithOtp(payload)
      await hydrate()
      router.replace("/dashboard")
    },
    [hydrate]
  )

  const registerUser = useCallback(
    async (payload: { name: string; email: string; phone: string; password: string; referralCode: string }) => {
      await register(payload)
      await hydrate()
      router.replace("/dashboard")
    },
    [hydrate]
  )

  const requestOtp = useCallback(async (payload: { email?: string; phone?: string; purpose?: "registration" | "login" | "password_reset" }) => {
    const response = await sendOtp(payload)
    return response.devOtp
  }, [])

  const verifyOtpCode = useCallback(async (payload: { code: string; email?: string; phone?: string; purpose?: "registration" | "login" | "password_reset" }) => {
    const response = await verifyOtp(payload)
    if (!response.success) {
      throw new Error(response.message)
    }
  }, [])

  const resetPasswordWithCode = useCallback(async (payload: { email: string; password: string; otpCode: string }) => {
    const response = await resetPassword(payload)
    if (!response.success) {
      throw new Error(response.message || "Failed to reset password")
    }
  }, [])

  const changePasswordWithCode = useCallback(async (payload: { currentPassword: string; newPassword: string; otpCode: string }) => {
    const response = await changePassword(payload)
    if (!response.success) {
      throw new Error(response.message || "Failed to update password")
    }
  }, [])

  const logoutUser = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      await secureStorage.deleteItem("auth-token")
      setUser(null)
      setBlocked(false)
      router.replace("/login")
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      blocked,
      loading,
      refreshing,
      loginWithPassword,
      loginWithCode,
      registerUser,
      requestOtp,
      verifyOtpCode,
      resetPasswordWithCode,
      changePasswordWithCode,
      logout: logoutUser,
      refresh: hydrate
    }),
    [
      user,
      blocked,
      loading,
      refreshing,
      loginWithPassword,
      loginWithCode,
      registerUser,
      requestOtp,
      verifyOtpCode,
      resetPasswordWithCode,
      changePasswordWithCode,
      logoutUser,
      hydrate
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
