import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { verifyToken } from "@/lib/auth"
import { fetchWalletContext } from "@/lib/services/wallet"
import { getMiningStatus } from "@/lib/services/mining"
import { multiplyAmountByPercent } from "@/lib/utils/numeric"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MiningWidget } from "@/components/dashboard/mining-widget"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Zap, Clock, Award } from "lucide-react"

export default async function MiningPage() {
  const cookieStore = cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) redirect("/auth/login")

  const session = await verifyToken(token)
  if (!session) redirect("/auth/login")

  const [walletContext, miningStatus] = await Promise.all([
    fetchWalletContext(session.userId),
    getMiningStatus(session.userId),
  ])

  if (!walletContext) redirect("/auth/login")

  const totalClicks = miningStatus.totalClicks
  const todayMined = miningStatus.earnedInCycle
  const efficiency = Math.min(Math.round(miningStatus.userStats.roiProgress), 100)

  const dailyProfitPercent = miningStatus.miningSettings.dailyProfitPercent
  const dailyProfitPreview = multiplyAmountByPercent(100, dailyProfitPercent)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-balance">Mint-Coin Mining</h1>
        <p className="text-muted-foreground">Mine rewards daily and track your performance.</p>
      </div>

      {/* Main widget */}
      <MiningWidget mining={miningStatus} />

      {/* Stats cards */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mined</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClicks}</div>
            <p className="text-xs text-muted-foreground">Mining actions performed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Mining</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${todayMined.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Original</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI Progress</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{efficiency}%</div>
            <p className="text-xs text-muted-foreground">Lowest</p>
          </CardContent>
        </Card>
      </section>

      {/* Efficiency */}
      <Card>
        <CardHeader>
          <CardTitle>Mining Efficiency</CardTitle>
          <CardDescription>Your current mining performance metrics</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">ROI Progress</span>
              <Badge
                variant={
                  efficiency >= 90 ? "default" : efficiency >= 70 ? "secondary" : "destructive"
                }
              >
                {efficiency}%
              </Badge>
            </div>

            <Progress value={efficiency} className="h-2" />

            <p className="text-xs text-muted-foreground">
              {efficiency >= 90
                ? "Earning cap approaching. Consider reinvestment."
                : efficiency >= 70
                ? "Solid progress. Keep mining daily."
                : "Grow your deposit or team to boost returns."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-muted p-4 text-center">
              <div className="text-lg font-semibold">{miningStatus.requiresDeposit ? "--" : "24h"}</div>
              <div className="text-muted-foreground">Mining Uptime</div>
            </div>

            <div className="rounded-lg bg-muted p-4 text-center">
              <div className="text-lg font-semibold">{dailyProfitPercent.toFixed(2)}%</div>
              <div className="text-muted-foreground">
                Daily profit • $100 → ${dailyProfitPreview.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 text-center">
              <div className="text-lg font-semibold">${walletContext.stats.currentBalance.toFixed(2)}</div>
              <div className="text-muted-foreground">Available balance</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
