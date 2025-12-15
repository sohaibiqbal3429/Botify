export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { isRedisEnabled } from "@/lib/redis"
import {
  enqueueMiningRequest,
  getMiningRequestStatus,
  isMiningQueueEnabled,
  MINING_STATUS_TTL_MS,
  type MiningRequestStatus,
} from "@/lib/services/mining-queue"
import { MiningActionError, performMiningClick } from "@/lib/services/mining"
import { recordMiningMetrics } from "@/lib/services/mining-metrics"
import {
  enforceUnifiedRateLimit,
  getClientIp,
  getRateLimitContext,
} from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"

// Works in Node + Edge-like runtimes (no node:crypto import)
function makeIdempotencyKey() {
  const g = globalThis as any
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID()
  return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const withTimeout = async <T,>(p: Promise<T>, ms = 12000): Promise<T> => {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Mining request timeout")), ms),
    ),
  ])
}

function buildStatusResponse(
  status: MiningRequestStatus,
  request: NextRequest,
  extraHeaders: Record<string, string> = {},
): NextResponse<{ status: MiningRequestStatus; statusUrl: string }> {
  const statusUrl = new URL("/api/mining/click/status", request.url)
  statusUrl.searchParams.set("key", status.idempotencyKey)

  let statusCode = 202
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Idempotency-Key": status.idempotencyKey,
    ...extraHeaders,
  }

  if (status.status === "queued" || status.status === "processing") {
    if (status.queueDepth !== undefined) headers["X-Queue-Depth"] = String(status.queueDepth)
  } else if (status.status === "completed") {
    statusCode = 200
    headers["Cache-Control"] = `private, max-age=0, s-maxage=${Math.floor(
      MINING_STATUS_TTL_MS / 1000,
    )}`
  } else {
    statusCode = status.error?.retryable ? 503 : 409
    if (status.error?.retryAfterMs) {
      const retrySeconds = Math.max(1, Math.ceil(status.error.retryAfterMs / 1000))
      headers["Retry-After"] = retrySeconds.toString()
      const backoffSeconds = Math.min(600, Math.pow(2, Math.ceil(Math.log2(retrySeconds))))
      headers["X-Backoff-Hint"] = backoffSeconds.toString()
    }
  }

  return NextResponse.json(
    { status, statusUrl: statusUrl.toString() },
    { status: statusCode, headers },
  )
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  const rateLimitContext = getRateLimitContext(request)
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    recordRequestLatency("backend", Date.now() - startedAt, {
      path,
      status: response.status,
      ...tags,
    })
    return response
  }

  // 1) Rate limit
  const rateDecision = await enforceUnifiedRateLimit("backend", rateLimitContext, { path })
  if (!rateDecision.allowed && rateDecision.response) {
    return respond(rateDecision.response, { outcome: "rate_limited" })
  }

  // 2) Auth
  const userPayload = getUserFromRequest(request)
  if (!userPayload) {
    return respond(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), {
      outcome: "unauthorized",
    })
  }

  // 3) Idempotency key
  let idempotencyKey =
    request.headers.get("idempotency-key")?.trim() ||
    request.headers.get("Idempotency-Key")?.trim() ||
    ""
  if (!idempotencyKey) idempotencyKey = makeIdempotencyKey()

  const ip = getClientIp(request)
  const queueAvailable = isRedisEnabled() && isMiningQueueEnabled()

  // Helper: direct processing (no queue OR enqueue failure fallback)
  const processDirect = async (successOutcome: string) => {
    try {
      const requestedAt = new Date()

      const result = await withTimeout(
        performMiningClick(userPayload.userId, { idempotencyKey }),
        12000,
      )

      const completedAt = new Date()

      await recordMiningMetrics({
        processed: 1,
        profitTotal: result.profit,
        roiCapReached: result.roiCapReached ? 1 : 0,
      })

      const status: MiningRequestStatus = {
        status: "completed",
        idempotencyKey,
        userId: userPayload.userId,
        requestedAt: requestedAt.toISOString(),
        updatedAt: completedAt.toISOString(),
        sourceIp: ip,
        userAgent: request.headers.get("user-agent"),
        queueDepth: 0,
        result: {
          ...result,
          message: (result as any).message || "Mining rewarded",
          completedAt: completedAt.toISOString(),
        },
      }

      return respond(buildStatusResponse(status, request), { outcome: successOutcome })
    } catch (error: any) {
      if (error instanceof MiningActionError) {
        return respond(
          NextResponse.json(
            {
              error: error.message,
              code: (error as any)?.code,
              retryable: (error as any)?.retryable,
            },
            { status: error.status, headers: { "Idempotency-Key": idempotencyKey } },
          ),
          { outcome: "mining_error" },
        )
      }

      if (String(error?.message || "").includes("timeout")) {
        return respond(
          NextResponse.json(
            { error: "Mining timeout. Please try again." },
            { status: 504, headers: { "Idempotency-Key": idempotencyKey } },
          ),
          { outcome: "timeout" },
        )
      }

      console.error("Mining click processing error", error)
      return respond(
        NextResponse.json(
          { error: error?.message || "Unable to start mining. Please try again." },
          { status: 500, headers: { "Idempotency-Key": idempotencyKey } },
        ),
        { outcome: "processing_failure" },
      )
    }
  }

  // 4) If queue not available -> direct
  if (!queueAvailable) return processDirect("completed_no_queue")

  // 5) If already exists -> return existing
  const existingStatus = await getMiningRequestStatus(idempotencyKey)
  if (existingStatus) {
    if (existingStatus.userId !== userPayload.userId) {
      return respond(
        NextResponse.json(
          { error: "Idempotency key belongs to another user" },
          { status: 409, headers: { "Idempotency-Key": idempotencyKey } },
        ),
        { outcome: "idempotency_conflict" },
      )
    }
    return respond(buildStatusResponse(existingStatus, request), { outcome: "duplicate" })
  }

  // 6) Enqueue -> return statusUrl (client polls it)
  try {
    const enqueueResult = await enqueueMiningRequest({
      userId: userPayload.userId,
      idempotencyKey,
      sourceIp: ip,
      userAgent: request.headers.get("user-agent"),
    })

    return respond(buildStatusResponse(enqueueResult.status, request), { outcome: "enqueued" })
  } catch (error) {
    console.error("Mining click enqueue error; falling back to direct processing", error)
    return processDirect("completed_after_enqueue_failure")
  }
}
