"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { KPICards } from "@/components/dashboard/kpi-cards"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { HalvingChart } from "@/components/dashboard/halving-chart"
import { RateLimitTelemetryCard } from "@/components/dashboard/rate-limit-telemetry"
import { Sidebar } from "@/components/layout/sidebar"

interface DashboardData {
  kpis: {
    totalEarning: number
    totalBalance: number
    currentBalance: number
    activeMembers: number
    totalWithdraw: number
    pendingWithdraw: number
    teamReward: number
    teamRewardToday?: number
  }
  mining: { canMine: boolean; nextEligibleAt: string; earnedInCycle: number }
  user: { level: number; referralCode: string; roiEarnedTotal: number; depositTotal: number }
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
      const [dashboardRes, userRes] = await Promise.all([
        fetch("/api/dashboard", { credentials: "include" }),
        fetch("/api/auth/me", { credentials: "include" }),
      ])

      const [dashboardPayload, userPayload] = await Promise.all([parseResponse(dashboardRes), parseResponse(userRes)])

      if (dashboardRes.status === 401 || userRes.status === 401) return router.replace("/auth/login")
      if (dashboardRes.status === 403) return router.replace("/auth/login?blocked=1")

      if (dashboardRes.ok && userRes.ok && dashboardPayload.json && userPayload.json) {
        setData(dashboardPayload.json as DashboardData)
        setUser((userPayload.json as any).user)
        setErrorMessage(null)
        return
      }

      const dashError =
        (dashboardPayload.json && typeof dashboardPayload.json === "object" && (dashboardPayload.json as any).error) ||
        dashboardPayload.rawText

      setErrorMessage(typeof dashError === "string" && dashError.trim() ? dashError.trim() : "Failed to load dashboard data")
    } catch (e) {
      console.error(e)
      setErrorMessage("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void fetchDashboardData() }, [fetchDashboardData])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="panel w-[min(520px,92vw)] p-6 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[hsl(var(--accent))]" />
          <p className="mt-3 text-sm text-white/60">Loading 5gBotify console…</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="panel w-[min(560px,92vw)] p-6">
          <div className="text-lg font-bold">Couldn’t load dashboard</div>
          <p className="mt-2 text-sm text-white/60">{errorMessage || "Refresh and try again."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar user={user} />

      <main className="min-w-0 p-5 md:p-8">
        <section className="panel p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs tracking-[0.18em] text-white/55">5gBotify</div>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Mining Console</h1>
              <p className="mt-2 text-sm text-white/60">
                Welcome back, <span className="font-semibold text-white/85">{user?.name}</span> • Level{" "}
                <span className="font-semibold text-white/85">{data.user.level}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Referral: <span className="font-mono">{data.user.referralCode}</span>
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                Status: <span className="text-[hsl(var(--accent))]">Synced</span>
              </span>
            </div>
          </div>
        </section>

        <div className="mt-5">
          <KPICards kpis={data.kpis} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <MiningWidget mining={data.mining} onMiningSuccess={fetchDashboardData} />
          </div>
          <div className="lg:col-span-7">
            <HalvingChart />
          </div>
          <div className="lg:col-span-12">
            <RateLimitTelemetryCard />
          </div>
        </div>
      </main>
    </div>
  )
}
