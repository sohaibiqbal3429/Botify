import mongoose from "mongoose"

import { type NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import { getUserFromRequest } from "@/lib/auth"
import { getClaimableTeamRewardTotal } from "@/lib/services/team-earnings"
import { QUALIFYING_DIRECT_DEPOSIT } from "@/lib/utils/leveling"

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

export async function getDailyTeamRewardTotal(
  userId: mongoose.Types.ObjectId | string,
  now: Date,
): Promise<number> {
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
  ])

  return Number(results?.[0]?.total ?? 0)
}

export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const user = await User.findById(userPayload.userId).lean()
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "Account blocked", blocked: true }, { status: 403 })
    }

    const userObjectId = ensureObjectId(user._id as any)

    let balanceDoc = await Balance.findOne({ userId: userObjectId }).lean()
    if (!balanceDoc) {
      const createdBalance = await Balance.create({
        userId: userObjectId,
        current: 0,
        totalBalance: 0,
        totalEarning: 0,
        lockedCapital: 0,
        staked: 0,
        pendingWithdraw: 0,
        teamRewardsAvailable: 0,
        teamRewardsClaimed: 0,
      })
      balanceDoc = createdBalance.toObject ? createdBalance.toObject() : (createdBalance as any)
    }

    const now = new Date()

    const [activeMembers, claimableTeamRewards, teamRewardToday] = await Promise.all([
      User.countDocuments({
        referredBy: userObjectId,
        $or: [{ qualified: true }, { depositTotal: { $gte: QUALIFYING_DIRECT_DEPOSIT } }],
      }),
      getClaimableTeamRewardTotal(userObjectId.toString()),
      getDailyTeamRewardTotal(userObjectId, now),
    ])

    const totalEarning = Number(balanceDoc?.totalEarning ?? 0)
    const totalBalance = Number(balanceDoc?.totalBalance ?? 0)
    const currentBalance = Number(balanceDoc?.current ?? 0)

    return NextResponse.json(
      {
        kpis: {
          totalEarning,
          totalBalance,
          currentBalance,
          activeMembers,
          totalWithdraw: Number(user.withdrawTotal ?? 0),
          pendingWithdraw: Number(balanceDoc?.pendingWithdraw ?? 0),
          teamReward: claimableTeamRewards,
          teamRewardToday,
        },
        user: {
          level: Number(user.level ?? 0),
          referralCode: user.referralCode ?? "",
          roiEarnedTotal: Number(user.roiEarnedTotal ?? 0),
          depositTotal: Number(user.depositTotal ?? 0),
        },
      },
      {
        headers: {
          "cache-control": "private, max-age=30",
        },
      },
    )
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
