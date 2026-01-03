// @ts-nocheck
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TransactionTable, type TransactionFilters } from "@/components/admin/transaction-table"
import { UserTable, type UserFilters } from "@/components/admin/user-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { formatNumberWithFallback } from "@/lib/utils/safe-parsing"
import type {
  AdminSessionUser,
  AdminStats,
  AdminTransactionRecord,
  AdminUserRecord,
  AdminPlatformSettings,
  AdminWalletSetting,
} from "@/lib/types/admin"
import { Input } from "@/components/ui/input"

type JsonRecord = Record<string, unknown>

interface TransactionsResponse extends JsonRecord {
  data?: AdminTransactionRecord[]
  nextCursor?: unknown
  error?: unknown
}

interface UsersResponse extends JsonRecord {
  data?: AdminUserRecord[]
  nextCursor?: unknown
  error?: unknown
}

interface StatsResponse extends JsonRecord {
  stats?: Partial<AdminStats>
  error?: unknown
}

async function readJsonSafe<T extends JsonRecord>(response: Response): Promise<T | null> {
  try {
    const clone = response.clone()
    const text = await clone.text()
    if (!text) {
      return null
    }

    try {
      return JSON.parse(text) as T
    } catch (parseError) {
      console.error("Failed to parse JSON response", parseError, {
        preview: text.slice(0, 200),
      })
      return null
    }
  } catch (error) {
    console.error("Unexpected error while reading response", error)
    return null
  }
}

function normalizeAdminStats(stats: Partial<AdminStats> | null | undefined): Partial<AdminStats> {
  if (!stats || typeof stats !== "object") {
    return {}
  }

  const numericKeys: Array<keyof AdminStats> = [
    "totalUsers",
    "activeUsers",
    "pendingDeposits",
    "pendingWithdrawals",
    "totalDeposits",
    "totalWithdrawals",
  ]

  const safeStats: Partial<AdminStats> = {}
  for (const key of numericKeys) {
    const value = stats[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      safeStats[key] = value
    }
  }

  return safeStats
}

interface AdminDashboardProps {
  initialUser: AdminSessionUser
  initialStats: AdminStats
  initialSettings: AdminPlatformSettings
  initialError?: string | null
}

const TRANSACTION_LIMIT = 50
const USER_LIMIT = 100
interface PendingAnnouncement {
  id: string
  winner: string
  announcementAt: string
  prizeUsd: number
}

export function AdminDashboard({ initialUser, initialStats, initialSettings, initialError = null }: AdminDashboardProps) {
  const [user, setUser] = useState(initialUser)
  const [stats, setStats] = useState(initialStats)
  const { toast } = useToast()

  const [walletSettings, setWalletSettings] = useState<AdminWalletSetting[]>(initialSettings.wallets ?? [])
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<AdminTransactionRecord[]>([])
  const [transactionCursor, setTransactionCursor] = useState<string | null>(null)
  const [transactionHasMore, setTransactionHasMore] = useState(false)
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>({})
  const [transactionLoading, setTransactionLoading] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(initialError)

  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [userCursor, setUserCursor] = useState<string | null>(null)
  const [userHasMore, setUserHasMore] = useState(false)
  const [userFilters, setUserFilters] = useState<UserFilters>({})
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState<string | null>(initialError)

  const transactionCursorRef = useRef<string | null>(null)
  const transactionLoadingRef = useRef(false)
  const userCursorRef = useRef<string | null>(null)
  const userLoadingRef = useRef(false)
  const lastStatsErrorRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)

  const runIfMounted = useCallback((callback: () => void) => {
    if (isMountedRef.current) {
      callback()
    }
  }, [])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchWalletSettings = useCallback(async () => {
    runIfMounted(() => {
      setWalletLoading(true)
      setWalletError(null)
    })

    try {
      const response = await fetch("/api/admin/settings/wallets", { cache: "no-store" })
      const payload = await readJsonSafe<{ wallets?: AdminWalletSetting[]; error?: unknown }>(response)

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Unable to load wallet settings"
        throw new Error(message)
      }

      const nextWallets = Array.isArray(payload?.wallets) ? payload.wallets : []
      runIfMounted(() => setWalletSettings(nextWallets))
    } catch (error) {
      console.error(error)
      runIfMounted(() =>
        setWalletError(error instanceof Error ? error.message : "Unable to load wallet settings"),
      )
    } finally {
      runIfMounted(() => setWalletLoading(false))
    }
  }, [runIfMounted])

  const handleWalletRefresh = useCallback(() => {
    fetchWalletSettings().catch(() => null)
  }, [fetchWalletSettings])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/stats", { cache: "no-store" })
      const payload = await readJsonSafe<StatsResponse>(response)

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Unable to load stats"
        throw new Error(message)
      }

      if (!payload) {
        throw new Error("Received an empty response while loading stats")
      }

      const normalized = normalizeAdminStats(payload.stats)
      if (Object.keys(normalized).length > 0) {
        runIfMounted(() => setStats((prev) => ({ ...prev, ...normalized })))
      }

      lastStatsErrorRef.current = null
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Unable to load stats"
      if (lastStatsErrorRef.current !== message) {
        toast({ variant: "destructive", description: message })
        lastStatsErrorRef.current = message
      }
    }
  }, [runIfMounted, toast])

  const fetchTransactions = useCallback(
    async (options: { reset?: boolean } = {}) => {
      if (transactionLoadingRef.current) return
      const isReset = options.reset ?? false
      transactionLoadingRef.current = true
      runIfMounted(() => {
        setTransactionLoading(true)
        setTransactionError(null)
      })

      const params = new URLSearchParams()
      params.set("limit", String(TRANSACTION_LIMIT))
      for (const [key, value] of Object.entries(transactionFilters)) {
        if (value) params.set(key, value)
      }

      const cursorToUse = isReset ? null : transactionCursorRef.current
      if (cursorToUse) {
        params.set("cursor", cursorToUse)
      }

      try {
        if (isReset) {
          transactionCursorRef.current = null
          runIfMounted(() => {
            setTransactionCursor(null)
            setTransactionHasMore(false)
            setTransactions([])
          })
        }
        const response = await fetch(`/api/admin/transactions?${params.toString()}`, { cache: "no-store" })
        const payload = await readJsonSafe<TransactionsResponse>(response)

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Unable to load transactions"
          throw new Error(message)
        }

        const nextCursorValue = typeof payload?.nextCursor === "string" && payload.nextCursor.length > 0 ? payload.nextCursor : null
        const transactionData = Array.isArray(payload?.data) ? payload.data : []

        if (!Array.isArray(payload?.data)) {
          console.warn("Unexpected transactions payload", payload)
          runIfMounted(() =>
            setTransactionError((current) => current ?? "Received an invalid response while loading transactions"),
          )
        }

        transactionCursorRef.current = nextCursorValue
        runIfMounted(() => {
          setTransactionCursor(nextCursorValue)
          setTransactionHasMore(Boolean(nextCursorValue) && transactionData.length > 0)
          setTransactions((prev) => (isReset ? transactionData : [...prev, ...transactionData]))
        })
      } catch (error) {
        console.error(error)
        runIfMounted(() =>
          setTransactionError(error instanceof Error ? error.message : "Unable to load transactions"),
        )
      } finally {
        transactionLoadingRef.current = false
        runIfMounted(() => setTransactionLoading(false))
      }
    },
    [runIfMounted, transactionFilters],
  )

  const fetchUsers = useCallback(
    async (options: { reset?: boolean } = {}) => {
      if (userLoadingRef.current) return
      const isReset = options.reset ?? false
      userLoadingRef.current = true
      runIfMounted(() => {
        setUserLoading(true)
        setUserError(null)
      })

      const params = new URLSearchParams()
      params.set("limit", String(USER_LIMIT))
      for (const [key, value] of Object.entries(userFilters)) {
        if (value) params.set(key, value)
      }

      const cursorToUse = isReset ? null : userCursorRef.current
      if (cursorToUse) {
        params.set("cursor", cursorToUse)
      }

      try {
        if (isReset) {
          userCursorRef.current = null
          runIfMounted(() => {
            setUserCursor(null)
            setUserHasMore(false)
            setUsers([])
          })
        }
        const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" })
        const payload = await readJsonSafe<UsersResponse>(response)

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Unable to load users"
          throw new Error(message)
        }

        const nextCursorValue = typeof payload?.nextCursor === "string" && payload.nextCursor.length > 0 ? payload.nextCursor : null
        const userData = Array.isArray(payload?.data) ? payload.data : []

        if (!Array.isArray(payload?.data)) {
          console.warn("Unexpected users payload", payload)
          runIfMounted(() => setUserError((current) => current ?? "Received an invalid response while loading users"))
        }

        userCursorRef.current = nextCursorValue
        runIfMounted(() => {
          setUserCursor(nextCursorValue)
          setUserHasMore(Boolean(nextCursorValue) && userData.length > 0)
          setUsers((prev) => (isReset ? userData : [...prev, ...userData]))
        })
      } catch (error) {
        console.error(error)
        runIfMounted(() => setUserError(error instanceof Error ? error.message : "Unable to load users"))
      } finally {
        userLoadingRef.current = false
        runIfMounted(() => setUserLoading(false))
      }
    },
    [runIfMounted, userFilters],
  )

  useEffect(() => {
    fetchTransactions({ reset: true }).catch(() => null)
  }, [fetchTransactions])

  useEffect(() => {
    fetchUsers({ reset: true }).catch(() => null)
  }, [fetchUsers])

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }
        return readJsonSafe<{ user?: Partial<AdminSessionUser> }>(response)
      })
      .then((payload) => {
        if (payload?.user) {
          runIfMounted(() => setUser((prev) => ({ ...prev, ...payload.user })))
        }
      })
      .catch((error) => {
        console.error("Failed to refresh admin session", error)
      })
  }, [runIfMounted])

  const refreshAll = useCallback(async () => {
    transactionCursorRef.current = null
    userCursorRef.current = null
    runIfMounted(() => {
      setTransactionCursor(null)
      setUserCursor(null)
    })
    await Promise.allSettled([
      fetchTransactions({ reset: true }),
      fetchUsers({ reset: true }),
      fetchStats(),
      fetchWalletSettings(),
    ])
  }, [
    fetchStats,
    fetchTransactions,
    fetchUsers,
    fetchWalletSettings,
    runIfMounted,
  ])

  useEffect(() => {
    fetchStats().catch(() => null)
  }, [fetchStats])

  const handleTransactionFiltersChange = useCallback((next: TransactionFilters) => {
    transactionCursorRef.current = null
    setTransactionCursor(null)
    setTransactionFilters(next)
  }, [])

  const handleUserFiltersChange = useCallback((next: UserFilters) => {
    userCursorRef.current = null
    setUserCursor(null)
    setUserFilters(next)
  }, [])

  const handleExportTransactions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/transactions/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionFilters),
      })
      const payload = await readJsonSafe<{ error?: unknown }>(response)
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Failed to queue export"
        throw new Error(message)
      }
      if (typeof window !== "undefined") {
        window.alert("Export queued. You will receive an email when it is ready.")
      } else {
        toast({ description: "Export queued. You will receive an email when it is ready." })
      }
    } catch (error) {
      console.error(error)
      runIfMounted(() =>
        setTransactionError(error instanceof Error ? error.message : "Unable to queue export"),
      )
    }
  }, [runIfMounted, toast, transactionFilters])

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto md:ml-64">
        <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Monitor platform performance and review user activity.</p>
            </div>
            <Button onClick={refreshAll} variant="secondary" className="gap-2" disabled={transactionLoading || userLoading}>
              {transactionLoading || userLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={stats.totalUsers} />
            <StatCard label="Active users" value={stats.activeUsers} />
            <StatCard label="Pending deposits" value={stats.pendingDeposits} />
            <StatCard label="Pending withdrawals" value={stats.pendingWithdrawals} />
          </div>

          <Card className="gap-5 py-5">
            <CardHeader className="px-5 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Wallet addresses</CardTitle>
              </div>
              <CardDescription>
                Deposit wallet addresses are managed via environment variables (WALLET_ADDRESS_1, WALLET_ADDRESS_2, WALLET_ADDRESS_3) and cannot
                be edited from the admin panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="space-y-5">
                {walletSettings.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No wallet addresses configured in the environment.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    {walletSettings.map((wallet) => {
                      const sourceLabel = wallet.source === "env" ? "Environment default" : "Not configured"

                      return (
                        <div key={wallet.id} className="space-y-2">
                          <label className="text-sm font-medium" htmlFor={`wallet-${wallet.id}`}>
                            {wallet.label}
                          </label>
                          <Input
                            id={`wallet-${wallet.id}`}
                            value={wallet.address}
                            readOnly
                            disabled
                            placeholder="Not configured"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>Network: {wallet.network}</p>
                            <p>Source: {sourceLabel}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {walletError && <p className="text-sm text-destructive">{walletError}</p>}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={handleWalletRefresh}
                    disabled={walletLoading}
                  >
                    {walletLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <TransactionTable
            items={transactions}
            loading={transactionLoading}
            error={transactionError}
            hasMore={transactionHasMore}
            onLoadMore={() => fetchTransactions()}
            onRefresh={() => fetchTransactions({ reset: true })}
            onExport={handleExportTransactions}
            filters={transactionFilters}
            onFiltersChange={handleTransactionFiltersChange}
          />

          <UserTable
            items={users}
            loading={userLoading}
            error={userError}
            hasMore={userHasMore}
            onLoadMore={() => fetchUsers()}
            onRefresh={() => fetchUsers({ reset: true })}
            filters={userFilters}
            onFiltersChange={handleUserFiltersChange}
          />
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: unknown }) {
  const formattedValue = formatNumberWithFallback(value, "0")
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-5 pb-1">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <p className="text-2xl font-semibold">{formattedValue}</p>
      </CardContent>
    </Card>
  )
}
