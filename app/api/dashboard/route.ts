import mongoose from "mongoose"

import { type NextRequest, NextResponse } from "next/server"
import { getCachedJSON } from "@/lib/cache/server-cache"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import MiningSession from "@/models/MiningSession"
import Settings from "@/models/Settings"
import Transaction from "@/models/Transaction"
import { getUserFromRequest } from "@/lib/auth"
import { hasQualifiedDeposit } from "@/lib/utils/leveling"
import { getClaimableTeamRewardTotal } from "@/lib/services/team-earnings"
import { withTimeout } from "@/lib/utils/timeout"

const DASHBOARD_TTL_SECONDS = Number(process.env.DASHBOARD_CACHE_SECONDS ?? 5)
const DB_TIMEOUT_MS = Number(process.env.DB_TIMEOUT_MS ?? 1500)

function ensureObjectId(value: mongoose.Types.ObjectId | string) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value
  }

  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value)
  }

  throw new Error("Invalid ObjectId value")
}

function resolvePreviousUtcDayWindow(reference: Date) {
  const start = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - 1, 0, 0, 0, 0),
  )
  const end = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - 1, 23, 59, 59, 999),
  )

  return { start, end, dayKey: start.toISOString().slice(0, 10) }
}

async function getDailyTeamRewardTotal(userId: mongoose.Types.ObjectId | string, now: Date): Promise<number> {
  const { start, end, dayKey } = resolvePreviousUtcDayWindow(now)
  const userIdString = typeof userId === "string" ? userId : userId.toString()
  const idCandidates: (string | mongoose.Types.ObjectId)[] = [userIdString]

  if (mongoose.Types.ObjectId.isValid(userIdString)) {
    idCandidates.push(new mongoose.Types.ObjectId(userIdString))
  }

  const results = await Transaction.aggregate([
    {
      $match: {
        userId: { $in: idCandidates },
        type: "teamReward",
        status: "approved",
        "meta.source": "daily_team_earning",
        $or: [
          { "meta.day": dayKey },
          {
            createdAt: {
              $gte: start,
              $lte: end,
            },
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]).option({ maxTimeMS: DB_TIMEOUT_MS })

  return Number(results?.[0]?.total ?? 0)
}

export async function GET(request: NextRequest) {
  const requestStarted = Date.now()
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await withTimeout(dbConnect(), DB_TIMEOUT_MS, "db connect")

    const cacheKey = `dashboard:v2:${userPayload.userId}`
    const { value, hitLayer } = await getCachedJSON(cacheKey, DASHBOARD_TTL_SECONDS, async () => {
      const user = await User.findById(userPayload.userId)
        .select({
          depositTotal: 1,
          withdrawTotal: 1,
          roiEarnedTotal: 1,
          level: 1,
          referralCode: 1,
          isBlocked: 1,
          miningDailyRateOverridePct: 1,
        })
        .lean()

      if (!user) {
        throw new Error("User not found")
      }

      const userObjectId = ensureObjectId(user._id as any)

      const [balance, miningSession, settings] = await Promise.all([
        Balance.findOneAndUpdate(
          { userId: userObjectId },
          {
            $setOnInsert: {
              userId: userObjectId,
              current: 0,
              totalBalance: 0,
              totalEarning: 0,
              lockedCapital: 0,
              staked: 0,
              pendingWithdraw: 0,
              teamRewardsAvailable: 0,
              teamRewardsClaimed: 0,
            },
          },
          { upsert: true, new: true, lean: true },
        ),
        MiningSession.findOneAndUpdate({ userId: userObjectId }, { $setOnInsert: { userId: userObjectId } }, {
          upsert: true,
          new: true,
          lean: true,
        }),
        Settings.findOne().select({ gating: 1 }).lean(),
      ])

      const [directReferrals, claimableTeamRewards] = await Promise.all([
        User.find({ referredBy: userObjectId }).select({ depositTotal: 1, qualified: 1 }).lean(),
        getClaimableTeamRewardTotal(userObjectId.toString()),
      ])

      const activeMembers = directReferrals.filter((referral) => hasQualifiedDeposit(referral)).length

      const now = new Date()
      const nextEligibleAt = miningSession?.nextEligibleAt ?? now
      const minDeposit = Math.max(50, settings?.gating?.minDeposit ?? 50)
      const hasMinimumDeposit = (user.depositTotal ?? 0) >= minDeposit
      const canMine = hasMinimumDeposit && now >= nextEligibleAt

      const teamRewardsAvailable = claimableTeamRewards
      const teamRewardToday = await getDailyTeamRewardTotal(userObjectId, now)
      const totalEarning = balance?.totalEarning ?? 0
      const totalBalance = balance?.totalBalance ?? 0
      const currentBalance = balance?.current ?? 0

      return {
        kpis: {
          totalEarning,
          totalBalance,
          currentBalance,
          activeMembers,
          totalWithdraw: user.withdrawTotal ?? 0,
          pendingWithdraw: balance?.pendingWithdraw ?? 0,
          teamReward: teamRewardsAvailable,
          teamRewardToday,
        },
        mining: {
          canMine,
          requiresDeposit: !hasMinimumDeposit,
          minDeposit,
          nextEligibleAt: nextEligibleAt.toISOString(),
          earnedInCycle: miningSession?.earnedInCycle ?? 0,
        },
        user: {
          level: user.level ?? 0,
          referralCode: user.referralCode ?? "",
          roiEarnedTotal: user.roiEarnedTotal ?? 0,
          depositTotal: user.depositTotal ?? 0,
        },
      }
    })

    return NextResponse.json(value, {
      headers: {
        "Cache-Control": `private, max-age=${DASHBOARD_TTL_SECONDS}, stale-while-revalidate=${DASHBOARD_TTL_SECONDS * 6}`,
        "X-Cache": hitLayer,
        "X-Response-Time": `${Date.now() - requestStarted}ms`,
      },
    })
  } catch (error: any) {
    console.error("Dashboard error:", error)
    const status = /timed out/i.test(error?.message ?? "") ? 503 : 500
    const headers: Record<string, string> = {
      "Retry-After": "5",
      "Cache-Control": "no-store",
    }
    return NextResponse.json({ error: "Service unavailable" }, { status, headers })
  }
}
