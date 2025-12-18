"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { ImportantUpdateModal } from "@/components/dashboard/important-update-modal"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { RateLimitTelemetryCard } from "@/components/dashboard/rate-limit-telemetry"
import { HalvingChart } from "@/components/dashboard/halving-chart"
import { LuckyDrawCard } from "@/components/dashboard/lucky-draw-card"
import { InviteAndEarnPanel } from "@/components/dashboard/invite-and-earn-panel"

interface DashboardData {
  stats: {
    activeMembers: number
    totalWithdraw: number
    pendingWithdraw: number
    teamReward: number
    teamRewardToday?: number
  }
  mining: {
    canMine: boolean
    nextEligibleAt: string
    earnedInCycle: number
  }
  user: {
    level: number
    referralCode: string
    roiEarnedTotal: number
    depositTotal: number
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    const parseResponse = async (response: Response) => {
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

      if (contentType.includes("application/json")) {
        const json = await response.json().catch(() => null)
        return { json, rawText: "" }
      }

      const rawText = (await response.text().catch(() => "")) || ""
      return { json: null, rawText }
    }

    try {
      setLoading(true)
      setErrorMessage(null)

      const response = await fetch("/api/dashboard", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })

      if (!response.ok) {
        const { json, rawText } = await parseResponse(response)

        const msg =
          (json && (json.message || json.error)) ||
          rawText ||
          `Request failed with status ${response.status}`

        if (response.status === 401) {
          router.push("/login")
          return
        }

        setErrorMessage(msg)
        setData(null)
        return
      }

      const { json } = await parseResponse(response)

      if (!json) {
        setErrorMessage("Invalid response from server (expected JSON).")
        setData(null)
        return
      }

      setData(json as DashboardData)
      setUser((json as any)?.user ?? null)
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error)
      setErrorMessage("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your mining dashboard...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="font-medium text-foreground">Failed to load dashboard data</p>
          {errorMessage ? (
            <p className="max-w-md text-sm text-muted-foreground">{errorMessage}</p>
          ) : null}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fetchDashboardData()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Retry
            </button>
            <Link
              href="/"
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <ImportantUpdateModal />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Track stats, mine, and manage your account.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Profile
              </Link>
              <Link
                href="/logout"
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
              >
                Logout
              </Link>
            </div>
          </div>

          <KPICards data={data} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MiningWidget data={data} />
            </div>
            <RateLimitTelemetryCard />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <HalvingChart />
            </div>
            <div className="rounded-xl border p-6">
              <h2 className="text-lg font-semibold">Referral</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Share your referral code to earn more.
              </p>
              <div className="mt-4 rounded-md bg-muted px-4 py-3 font-mono text-sm">
                {(data as any)?.user?.referralCode ?? "-"}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LuckyDrawCard currentUser={user} />
            </div>
            <InviteAndEarnPanel referralCode={data.user.referralCode} />
          </div>
        </div>
      </main>
    </div>
  )
}
