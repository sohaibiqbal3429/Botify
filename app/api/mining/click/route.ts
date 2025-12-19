import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { enforceUnifiedRateLimit, getRateLimitContext } from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"
import {
  getMiningRequestStatus,
  enqueueMiningRequest,
  isMiningQueueEnabled,
  MiningStatusUnavailableError,
} from "@/lib/services/mining-queue"
import { MiningActionError, performMiningClick } from "@/lib/services/mining"

export const runtime = "nodejs"

function addRewardMessage<T extends { status: string; result?: Record<string, unknown> | null }>(status: T): T {
  if (status.status !== "completed") return status
  return {
    ...status,
    result: {
      message: "Rewarded",
      ...(status.result ?? {}),
    },
  }
}

const DEPENDENCY_TIMEOUT_MS = Number(process.env.MINING_CLICK_DEP_TIMEOUT_MS ?? 5000)
const INLINE_OPERATION_TIMEOUT_MS = Number(process.env.MINING_CLICK_INLINE_TIMEOUT_MS ?? 8000)

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message?.startsWith("TIMEOUT:")
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  const rateContext = getRateLimitContext(request)
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    recordRequestLatency("backend", Date.now() - startedAt, { path, status: response.status, ...tags })
    response.headers.set("Cache-Control", "no-store")
    return response
  }

  const json = (body: any, init?: ResponseInit, tags?: Record<string, string | number>) =>
    respond(NextResponse.json(body, init), tags)

  const rateDecision = await enforceUnifiedRateLimit("backend", rateContext, { path })
  if (!rateDecision.allowed && rateDecision.response) {
    return respond(rateDecision.response, { outcome: "rate_limited" })
  }

  const user = getUserFromRequest(request)
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 }, { outcome: "unauthorized" })
  }

  const queueEnabled = isMiningQueueEnabled()

  let idempotencyKey = request.headers.get("Idempotency-Key")?.trim()

  if (!idempotencyKey) {
    try {
      const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""
      if (contentType.includes("application/json")) {
        const body = await request.json().catch(() => null)
        const bodyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : ""
        if (bodyKey) idempotencyKey = bodyKey
      }
    } catch {
      // ignore body parse errors
    }
  }

  if (!idempotencyKey) {
    const today = new Date().toISOString().slice(0, 10)
    idempotencyKey = `mine:${user.userId}:${today}`
  }

  // ✅ FIX: build statusUrl from the current route path
  const makeStatusUrl = () => {
    const current = new URL(request.url)
    const u = new URL(request.url)

    // If POST is at ".../mining/click", status is at ".../mining/click/status"
    u.pathname = current.pathname.replace(/\/$/, "") + "/status"
    u.searchParams.set("key", idempotencyKey!)
    return u.toString()
  }

  if (!queueEnabled) {
    const requestedAt = new Date().toISOString()

    try {
      const result = await withTimeout(
        performMiningClick(user.userId, { idempotencyKey }),
        INLINE_OPERATION_TIMEOUT_MS,
        "perform-mining",
      )

      const status = addRewardMessage({
        status: "completed" as const,
        idempotencyKey,
        userId: user.userId,
        requestedAt,
        updatedAt: new Date().toISOString(),
        result,
      })

      return json(
        {
          idempotencyKey,
          statusUrl: makeStatusUrl(), // ✅ include for consistency
          status,
        },
        { status: 200 },
        { outcome: "inline_completed" },
      )
    } catch (err: any) {
      if (isTimeoutError(err)) {
        return json(
          {
            error: "Mining service is responding slowly. Please retry shortly.",
            idempotencyKey,
          },
          { status: 503, headers: { "Retry-After": "3" } },
          { outcome: "inline_timeout" },
        )
      }

      const status = err instanceof MiningActionError ? err.status ?? 400 : 500
      return json(
        {
          error: err instanceof MiningActionError ? err.message : "Unable to start mining",
          detail: err?.message ?? String(err),
          idempotencyKey,
        },
        { status },
        { outcome: "inline_error" },
      )
    }
  }

  try {
    const existing = await withTimeout(
      getMiningRequestStatus(idempotencyKey),
      DEPENDENCY_TIMEOUT_MS,
      "get-status",
    )
    if (existing && existing.userId === user.userId) {
      const headers: Record<string, string> = { "Cache-Control": "no-store" }
      if (existing.queueDepth !== undefined) headers["X-Queue-Depth"] = String(existing.queueDepth)

      const normalized = addRewardMessage(existing)

      const statusCode =
        normalized.status === "completed"
          ? 200
          : normalized.status === "failed"
            ? normalized.error?.retryable
              ? 503
              : 409
            : 202

      return json(
        { status: normalized, statusUrl: makeStatusUrl(), idempotencyKey },
        { status: statusCode, headers },
        { outcome: `existing_${normalized.status}` },
      )
    }

    const { status } = await withTimeout(
      enqueueMiningRequest({
        userId: user.userId,
        idempotencyKey,
      }),
      DEPENDENCY_TIMEOUT_MS,
      "enqueue",
    )

    const headers: Record<string, string> = { "Cache-Control": "no-store" }
    if (status.queueDepth !== undefined) headers["X-Queue-Depth"] = String(status.queueDepth)

    const normalized = addRewardMessage(status)

    return json(
      { status: normalized, statusUrl: makeStatusUrl(), idempotencyKey },
      { status: normalized.status === "completed" ? 200 : 202, headers },
      { outcome: normalized.status },
    )
  } catch (err: any) {
    console.error("[mining/click] enqueue failed:", err)
    if (isTimeoutError(err) || err instanceof MiningStatusUnavailableError) {
      return json(
        { error: "Mining queue temporarily unavailable. Please retry." },
        { status: 503, headers: { "Retry-After": "3" } },
        { outcome: "queue_unavailable" },
      )
    }

    return json(
      {
        error: "Unable to start mining",
        detail: err?.message ?? String(err),
        idempotencyKey,
      },
      { status: 500 },
      { outcome: "exception" },
    )
  }
}
