// @ts-nocheck
import mongoose from "mongoose"
import crypto from "crypto"
import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getRateLimitContext, enforceUnifiedRateLimit } from "@/lib/rate-limit/unified"
import dbConnect from "@/lib/mongodb"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import User from "@/models/User"

// ✅ CONFIG
const COOLDOWN_MS = 24 * 60 * 60 * 1000
const MISSION_SOURCE = "DAILY_PROFIT_MISSION"
const REWARD_PCT = 0.025 // 2.5%
const MIN_DEPOSIT = 50 // ✅ deposit required

class CooldownError extends Error {
  nextEligibleAt: Date
  constructor(nextEligibleAt: Date, message = "Daily mission cooldown active") {
    super(message)
    this.name = "CooldownError"
    this.nextEligibleAt = nextEligibleAt
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function toNumberSafe(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export async function POST(request: NextRequest) {
  // Rate limit
  const rateLimitContext = getRateLimitContext(request)
  const decision = await enforceUnifiedRateLimit("backend", rateLimitContext, {
    path: "/api/missions/daily-profit/complete",
  })
  if (!decision.allowed && decision.response) return decision.response

  // Auth
  const session = getUserFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await dbConnect()

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || null

  // ✅ Idempotency (same request repeat -> return same result)
  if (idempotencyKey) {
    const existing = await Transaction.findOne({
      userId: session.userId,
      "meta.source": MISSION_SOURCE,
      "meta.idempotencyKey": idempotencyKey,
    }).lean()

    if (existing) {
      const balanceAfter = Number((existing as any).meta?.balanceAfter ?? 0)
      const rewardAmount = Number((existing as any).amount ?? 0)
      const nextEligibleAt = (existing as any).meta?.nextEligibleAt
        ? new Date((existing as any).meta.nextEligibleAt)
        : new Date(Date.now() + COOLDOWN_MS)

      return NextResponse.json({
        rewardAmount,
        newBalance: balanceAfter,
        nextEligibleAt: nextEligibleAt.toISOString(),
        message: "Rewarded",
      })
    }
  }

  const now = new Date()

  const user = await User.findById(session.userId)
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // ✅ Deposit required (simple gate)
  const depositTotal = toNumberSafe((user as any).depositTotal, 0)
  if (depositTotal < MIN_DEPOSIT) {
    return NextResponse.json(
      { error: `Minimum deposit required: $${MIN_DEPOSIT}. Your deposits: $${depositTotal.toFixed(2)}` },
      { status: 400 },
    )
  }

  const sessionDb = await mongoose.startSession()

  let rewardAmount = 0
  let newBalance = 0
  let nextEligibleAt: Date | null = null

  try {
    await sessionDb.withTransaction(async () => {
      // Ensure balance exists
      const balance =
        (await Balance.findOne({ userId: user._id }).session(sessionDb)) ||
        (await Balance.create(
          [
            {
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
            },
          ],
          { session: sessionDb },
        ).then((docs) => docs[0]))

      if (!balance) {
        throw new Error("BALANCE_NOT_CREATED")
      }

      const currentBalance = Number(balance.current ?? 0)

      // ✅ Balance required
      if (!Number.isFinite(currentBalance) || currentBalance <= 0) {
        throw new Error("INSUFFICIENT_BALANCE")
      }

      rewardAmount = roundCurrency(currentBalance * REWARD_PCT)
      nextEligibleAt = new Date(now.getTime() + COOLDOWN_MS)

      // ✅ Cooldown guard (atomic)
      const updateResult = await User.updateOne(
        {
          _id: user._id,
          $or: [
            { dailyProfitNextEligibleAt: { $lte: now } },
            { dailyProfitNextEligibleAt: null },
            { dailyProfitNextEligibleAt: { $exists: false } },
          ],
        },
        {
          $set: {
            dailyProfitNextEligibleAt: nextEligibleAt,
            dailyProfitLastClaimedAt: now,
            dailyProfitLastRewardAmount: rewardAmount,
          },
        },
        { session: sessionDb },
      )

      if (updateResult.matchedCount === 0) {
        const existingUser = await User.findById(user._id).session(sessionDb)
        const next =
          (existingUser?.dailyProfitNextEligibleAt as any) ??
          nextEligibleAt ??
          new Date(now.getTime() + COOLDOWN_MS)
        throw new CooldownError(next)
      }

      // Apply reward
      const balanceBefore = currentBalance
      newBalance = roundCurrency(balanceBefore + rewardAmount)

      balance.current = newBalance
      balance.totalBalance = roundCurrency(Number(balance.totalBalance ?? 0) + rewardAmount)
      balance.totalEarning = roundCurrency(Number(balance.totalEarning ?? 0) + rewardAmount)
      await balance.save({ session: sessionDb })

      // ✅ Transaction meta (uniqueEventId NEVER null)
      const meta: Record<string, unknown> = {
        source: MISSION_SOURCE,
        balanceBefore,
        balanceAfter: newBalance,
        rewardPct: REWARD_PCT * 100,
        description: "Daily Profit Mission reward",
        nextEligibleAt: nextEligibleAt.toISOString(),
        uniqueEventId: idempotencyKey || crypto.randomUUID(),
      }
      if (idempotencyKey) meta.idempotencyKey = idempotencyKey

      await Transaction.create(
        [
          {
            userId: user._id,
            type: "missionReward",
            amount: rewardAmount,
            status: "approved",
            userEmail: (user as any).email ?? undefined,
            meta,
          },
        ],
        { session: sessionDb },
      )
    })
  } catch (error: any) {
    if (error instanceof CooldownError) {
      const retrySeconds = Math.max(1, Math.ceil((error.nextEligibleAt.getTime() - now.getTime()) / 1000))
      return NextResponse.json(
        { error: "Cooldown active", nextEligibleAt: error.nextEligibleAt.toISOString() },
        { status: 429, headers: { "Retry-After": retrySeconds.toString() } },
      )
    }

    if (error?.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Insufficient balance. Add balance to claim daily profit." },
        { status: 400 },
      )
    }

    // Duplicate tx due to parallel idempotency insert
    if (error?.code === 11000 && idempotencyKey) {
      const existingTx = await Transaction.findOne({
        userId: user._id,
        "meta.source": MISSION_SOURCE,
        "meta.idempotencyKey": idempotencyKey,
      }).lean()

      if (existingTx) {
        return NextResponse.json({
          rewardAmount: Number((existingTx as any).amount ?? 0),
          newBalance: Number((existingTx as any).meta?.balanceAfter ?? 0),
          nextEligibleAt: (existingTx as any).meta?.nextEligibleAt ?? null,
          message: "Rewarded",
        })
      }
    }

    console.error("Daily profit mission error:", error)
    return NextResponse.json({ error: "Unable to complete mission" }, { status: 500 })
  } finally {
    await sessionDb.endSession()
  }

  // ✅ Success response
  return NextResponse.json({
    rewardAmount,
    newBalance,
    nextEligibleAt: nextEligibleAt instanceof Date ? nextEligibleAt.toISOString() : null,
    message: "Rewarded",
  })
}
c