import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getRateLimitContext, enforceUnifiedRateLimit } from "@/lib/rate-limit/unified"
import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import User from "@/models/User"

export async function GET(request: NextRequest) {
  const rateLimitContext = getRateLimitContext(request)
  const decision = await enforceUnifiedRateLimit("backend", rateLimitContext, { path: "/api/missions/daily-profit/status" })
  if (!decision.allowed && decision.response) {
    return decision.response
  }

  const session = getUserFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await dbConnect()

  const [user, balanceDoc] = await Promise.all([
    User.findById(session.userId),
    Balance.findOne({ userId: session.userId }),
  ])

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const balance =
    balanceDoc ??
    (await Balance.create({
      userId: user._id,
      current: 0,
      totalBalance: 0,
      totalEarning: 0,
      lockedCapital: 0,
      lockedCapitalLots: [],
      staked: 0,
      pendingWithdraw: 0,
      teamRewardsAvailable: 0,
      teamRewardsClaimed: 0,
      luckyDrawCredits: 0,
    }))

  const now = new Date()
  const nextEligible = user.dailyProfitNextEligibleAt ?? null
  const canClaim = !nextEligible || now >= nextEligible

  return NextResponse.json({
    canClaim,
    nextEligibleAt: nextEligible ? nextEligible.toISOString() : null,
    currentBalance: Number(balance.current ?? 0),
    lastRewardAmount: user.dailyProfitLastRewardAmount ?? null,
    lastClaimedAt: user.dailyProfitLastClaimedAt ? user.dailyProfitLastClaimedAt.toISOString() : null,
  })
}
