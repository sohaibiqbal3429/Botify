import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY
} from "./api"
import { secureStorage } from "./storage"
import type {
  AuthLoginResponse,
  AuthMeResponse,
  AdminSummaryResponse,
  WalletBalanceResponse,
  WithdrawHistoryResponse,
  WithdrawRequestPayload,
  DepositAddressResponse,
  TasksResponse,
  TaskClaimResponse,
  TeamStructureResponse,
  TeamRewardsResponse,
  FaqResponse,
  SupportTicketsResponse,
  SupportTicketPayload,
  CoinListResponse
} from "../types/api-contracts"

export async function login(identifier: string, identifierType: "email" | "phone", password: string) {
  const response = await apiPost<AuthLoginResponse>("/auth/login", {
    identifier,
    identifierType,
    password
  })
  if (response.token) {
    await secureStorage.setItem(AUTH_TOKEN_KEY, response.token)
  }
  return response
}

export async function loginWithOtp(payload: { email?: string; phone?: string; otpCode: string }) {
  const response = await apiPost<AuthLoginResponse>("/auth/login-with-otp", payload)
  if ((response as any)?.token) {
    await secureStorage.setItem(AUTH_TOKEN_KEY, (response as any).token as string)
  }
  return response
}

export async function register(payload: {
  name: string
  email: string
  phone: string
  password: string
  referralCode: string
}) {
  const response = await apiPost<AuthLoginResponse>("/auth/register", payload)
  if (response.token) {
    await secureStorage.setItem(AUTH_TOKEN_KEY, response.token)
  }
  return response
}

export async function sendOtp(payload: { email?: string; phone?: string; purpose?: "registration" | "login" | "password_reset" }) {
  return apiPost<{ success: boolean; message: string; devOtp?: string }>("/auth/send-otp", payload)
}

export async function verifyOtp(payload: { code: string; email?: string; phone?: string; purpose?: "registration" | "login" | "password_reset" }) {
  return apiPost<{ success: boolean; message: string }>("/auth/verify-otp", payload)
}

export async function resetPassword(payload: { email: string; password: string; otpCode: string }) {
  return apiPost<{ success: boolean; message?: string }>("/auth/reset-password", payload)
}

export async function changePassword(payload: { currentPassword: string; newPassword: string; otpCode: string }) {
  return apiPost<{ success: boolean; message?: string }>("/profile/change-password", payload)
}

export async function logout() {
  await apiPost<{ success: boolean }>("/auth/logout")
  await secureStorage.deleteItem(AUTH_TOKEN_KEY)
  await secureStorage.deleteItem(REFRESH_TOKEN_KEY)
}

export async function fetchMe() {
  return apiGet<AuthMeResponse>("/auth/me")
}

export async function fetchAuthStatus() {
  return apiGet<{ blocked: boolean }>("/auth/status")
}

export async function fetchDashboard() {
  return apiGet<Record<string, any>>("/dashboard")
}

export async function fetchWalletBalance() {
  return apiGet<WalletBalanceResponse>("/wallet/balance")
}

export async function fetchDepositAddress() {
  return apiGet<DepositAddressResponse>("/wallet/deposit-address")
}

export async function submitDeposit(payload: { amount: number; txHash?: string; network?: string }) {
  return apiPost<{ success: boolean; message?: string }>("/wallet/deposit", payload)
}

export async function submitWithdraw(payload: WithdrawRequestPayload) {
  return apiPost<{ success: boolean; message?: string }>("/wallet/withdraw", payload)
}

export async function fetchWithdrawHistory(page = 1, limit = 20) {
  return apiGet<WithdrawHistoryResponse>("/wallet/withdraw-history", { page, limit })
}

export async function fetchTransactions(page = 1, limit = 20) {
  return apiGet<{ success: boolean; data: any[]; pagination: any }>("/transactions", { page, limit })
}

export async function fetchActivity(page = 1, limit = 20) {
  return fetchTransactions(page, limit)
}

export async function fetchTeamStructure(page = 1, limit = 50) {
  return apiGet<TeamStructureResponse>("/team/structure", { page, limit })
}

export async function fetchTeamRewards() {
  return apiGet<TeamRewardsResponse>("/team/rewards")
}

export async function claimReward(taskId: string) {
  return apiPost<TaskClaimResponse>("/tasks/claim", { taskId })
}

export async function fetchTasks() {
  return apiGet<TasksResponse>("/tasks")
}

export async function fetchFaq() {
  return apiGet<FaqResponse>("/support/faq")
}

export async function submitTicket(payload: SupportTicketPayload) {
  return apiPost<{ success: boolean }>(`/support`, payload)
}

export async function fetchTickets() {
  return apiGet<SupportTicketsResponse>("/support")
}

export async function fetchCoins() {
  return apiGet<CoinListResponse>("/coins")
}

export async function fetchAdminSummary() {
  return apiGet<AdminSummaryResponse>("/admin/stats")
}

export async function fetchAdminUsers(page = 1, limit = 20) {
  return apiGet<{ success: boolean; users: any[]; pagination: any }>("/admin/users", { page, limit })
}

export async function fetchAdminTransactions(page = 1, limit = 20) {
  return apiGet<{ success: boolean; transactions: any[]; pagination: any }>("/admin/transactions", { page, limit })
}

export async function blockUser(userId: string) {
  return apiPost<{ success: boolean }>(`/admin/users/${userId}/block`)
}

export async function updateProfile(payload: { name: string; avatar?: string }) {
  return apiPatch<{ message: string; user: any }>("/profile", payload)
}
