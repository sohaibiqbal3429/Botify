// @ts-nocheck
import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import Transaction from "@/models/Transaction"
import { calculateWithdrawableSnapshot } from "@/lib/utils/locked-capital"
import { signToken } from "@/lib/auth"
import { POST as withdrawRoute } from "@/app/api/wallet/withdraw/route"
import { POST as approveWithdrawRoute } from "@/app/api/admin/approve-withdraw/route"

const apiBase = "http://localhost"

async function resetCollections() {
  await dbConnect()
  await Promise.all([User.deleteMany({}), Balance.deleteMany({}), Transaction.deleteMany({})])
}

async function createUser(overrides: Record<string, unknown> = {}) {
  await dbConnect()
  const base = {
    email: `user-${Math.random().toString(16).slice(2)}@example.com`,
    passwordHash: "hash",
    name: "Test User",
    role: "user",
    referralCode: `RC${Math.random().toString(16).slice(2, 8)}`,
    status: "active",
    isActive: true,
    isBlocked: false,
    profileAvatar: "avatar-01",
    phone: "+15551234567",
    phoneVerified: true,
    emailVerified: true,
  }
  return User.create({ ...base, ...overrides } as any)
}

function toId(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof (value as { toString?: () => string })?.toString === "function"
      ? (value as { toString: () => string }).toString()
      : ""
}

function createAuthorizedRequest(url: string, method: string, tokenPayload: { userId: string; email: string; role: string }, body?: unknown) {
  const token = signToken(tokenPayload)
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  return new NextRequest(new Request(url, init))
}

test.before(async () => {
  await dbConnect()
})

test.beforeEach(async () => {
  await resetCollections()
})

test("approved withdrawals keep requested funds deducted from withdrawable balance", async () => {
  const admin = await createUser({
    email: "withdraw-admin@example.com",
    role: "admin",
    referralCode: "ADMIN789",
  })
  const user = await createUser({ email: "withdraw-flow@example.com" })

  await Balance.create({
    userId: user._id,
    current: 100,
    totalBalance: 100,
    totalEarning: 100,
    pendingWithdraw: 0,
    staked: 0,
  })

  const withdrawRequest = createAuthorizedRequest(
    `${apiBase}/api/wallet/withdraw`,
    "POST",
    { userId: toId(user._id), email: user.email, role: user.role },
    { amount: 50, walletAddress: "TWALLET123456789" },
  )
  const withdrawResponse = await withdrawRoute(withdrawRequest)
  assert.equal(withdrawResponse.status, 200)
  const withdrawPayload = (await withdrawResponse.json()) as any
  assert.ok(withdrawPayload?.transaction?.id)

  const postWithdrawBalance = await Balance.findOne({ userId: user._id })
  assert.equal(Number(postWithdrawBalance?.current ?? 0), 50)
  assert.equal(Number(postWithdrawBalance?.totalBalance ?? 0), 50)
  assert.equal(Number(postWithdrawBalance?.pendingWithdraw ?? 0), 50)

  const pendingSnapshot = calculateWithdrawableSnapshot(postWithdrawBalance as any, new Date())
  assert.equal(pendingSnapshot.withdrawable, 50)

  const approveRequest = createAuthorizedRequest(
    `${apiBase}/api/admin/approve-withdraw`,
    "POST",
    { userId: toId(admin._id), email: admin.email, role: admin.role },
    { transactionId: withdrawPayload.transaction.id },
  )
  const approveResponse = await approveWithdrawRoute(approveRequest)
  assert.equal(approveResponse.status, 200)
  const approvePayload = (await approveResponse.json()) as any
  assert.equal(approvePayload.success, true)

  const finalBalance = await Balance.findOne({ userId: user._id })
  assert.equal(Number(finalBalance?.pendingWithdraw ?? 0), 0)
  assert.equal(Number(finalBalance?.current ?? 0), 50)
  assert.equal(Number(finalBalance?.totalBalance ?? 0), 50)

  const finalSnapshot = calculateWithdrawableSnapshot(finalBalance as any, new Date())
  assert.equal(finalSnapshot.withdrawable, 50)

  const refreshedUser = await User.findById(user._id)
  assert.equal(Number(refreshedUser?.withdrawTotal ?? 0), 50)
})
