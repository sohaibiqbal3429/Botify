import axios, { AxiosError } from "axios"
import Constants from "expo-constants"
import { secureStorage } from "./storage"

const envExtra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  envExtra.EXPO_PUBLIC_API_BASE_URL ||
  envExtra.API_BASE_URL ||
  "https://mintminepro.com/api"

export type ApiError = {
  message?: string
  status?: number
  details?: unknown
}

export const AUTH_TOKEN_KEY = process.env.AUTH_TOKEN_KEY || "auth-token"
export const REFRESH_TOKEN_KEY = process.env.REFRESH_TOKEN_KEY || "refresh-token"

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  withCredentials: true
})

client.interceptors.request.use(async (config) => {
  const token = await secureStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await secureStorage.deleteItem(AUTH_TOKEN_KEY)
      await secureStorage.deleteItem(REFRESH_TOKEN_KEY)
    }
    throw error
  }
)

export function getErrorPayload(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    return {
      status: error.response?.status,
      message:
        (error.response?.data as any)?.error ||
        (error.response?.data as any)?.message ||
        error.message,
      details: error.response?.data
    }
  }
  if (error instanceof Error) return { message: error.message }
  return { message: "Unknown error" }
}

export async function apiGet<T>(path: string, params?: Record<string, unknown>) {
  const res = await client.get<T>(path, { params })
  return res.data
}

export async function apiPost<T>(path: string, body?: unknown) {
  const res = await client.post<T>(path, body)
  const token = (res.data as any)?.token
  if (token) {
    await secureStorage.setItem(AUTH_TOKEN_KEY, token)
  }
  return res.data
}

export async function apiPatch<T>(path: string, body?: unknown) {
  const res = await client.patch<T>(path, body)
  return res.data
}

export async function apiDelete<T>(path: string) {
  const res = await client.delete<T>(path)
  return res.data
}

export { client as apiClient }
