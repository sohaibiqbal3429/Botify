import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { isRedisEnabled } from "@/lib/redis"
import {
  enqueueMiningRequest,
  getMiningRequestStatus,
  isMiningQueueEnabled,
  isMiningWorkerAlive,
  markMiningStatusCompleted,
  markMiningStatusFailed,
  markMiningStatusProcessing,
  type MiningRequestStatus,
} from "@/lib/services/mining-queue"
import { enforceUnifiedRateLimit, getClientIp, getRateLimitContext } from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"
import { performMiningClick, MiningActionError } from "@/lib/services/mining"

// バ. CRITICAL: mongoose/transactions must run on node runtime
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REDIS_TIMEOUT_MS = 1400
const RATE_LIMIT_TIMEOUT_MS = 1400
const WORKER_STALE_MS = 120_000
const NO_STORE = "no-store"
const HARD_RESPONSE_TIMEOUT_MS = 3200
const INLINE_MINING_TIMEOUT_MS = 2000

function makeIdempotencyKey() {
  const g = globalThis as any
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID()
  return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    promise
      .then((v) => resolve(v))
      .catch((e) => reject(e))
      .finally(() => clearTimeout(id))
  })
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
    "Cache-Control": NO_STORE,
    "Idempotency-Key": status.idempotencyKey,
    ...extraHeaders,
  }

  if (status.status === "queued" || status.status === "processing") {
    if (status.queueDepth !== undefined) headers["X-Queue-Depth"] = String(status.queueDepth)
  } else if (status.status === "completed") {
    statusCode = 200
  } else {
    statusCode = status.error?.retryable ? 503 : 409
    if (status.error?.retryAfterMs) {
      const retrySeconds = Math.max(1, Math.ceil(status.error.retryAfterMs / 1000))
      headers["Retry-After"] = retrySeconds.toString()
    }
  }

  return NextResponse.json({ status, statusUrl: statusUrl.toString() }, { status: statusCode, headers })
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  const rateLimitContext = getRateLimitContext(request)
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    console.info("[mining] click:return", { path, status: response.status, tags, latencyMs: Date.now() - startedAt })
    recordRequestLatency("backend", Date.now() - startedAt, { path, status: response.status, ...tags })
    return response
  }

  const mainFlow = async (): Promise<NextResponse> => {
    console.info("[mining] click:start", { path })

    // 1) Rate limit (bounded)
    try {
      const rateDecision = await withTimeout(
        enforceUnifiedRateLimit("backend", rateLimitContext, { path }),
        RATE_LIMIT_TIMEOUT_MS,
        "rate_limit",
      )
      if (!rateDecision.allowed && rateDecision.response) {
        return respond(rateDecision.response, { outcome: "rate_limited" })
      }
    } catch (error) {
      console.error("[mining] click:rate_limit_timeout", error)
      return respond(
        NextResponse.json(
          { error: "Mining temporarily unavailable. Please retry shortly.", retryAfterSeconds: 2 },
          { status: 503, headers: { "Retry-After": "2", "Cache-Control": NO_STORE } },
        ),
        { outcome: "rate_limit_timeout" },
      )
    }

    // 2) Auth
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return respond(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), { outcome: "unauthorized" })
    }
    console.info("[mining] click:auth_ok", { userId: userPayload.userId })

    // 3) Idempotency
    let idempotencyKey =
      request.headers.get("idempotency-key")?.trim() ||
      request.headers.get("Idempotency-Key")?.trim() ||
      ""
    if (!idempotencyKey) idempotencyKey = makeIdempotencyKey()

    const ip = getClientIp(request)

    // Queue availability
    const queueAvailable = isRedisEnabled() && isMiningQueueEnabled()
    if (!queueAvailable) {
      return respond(
        NextResponse.json(
          { error: "Mining queue unavailable. Please try again soon." },
          { status: 503, headers: { "Idempotency-Key": idempotencyKey, "Cache-Control": NO_STORE } },
        ),
        { outcome: "queue_unavailable" },
      )
    }

    // Worker heartbeat (soft check; do not hard-fail)
    let workerAlive = false
    try {
      console.info("[mining] click:worker_check_start", { userId: userPayload.userId })
      workerAlive = await withTimeout(isMiningWorkerAlive(WORKER_STALE_MS), 600, "worker_heartbeat")
      console.info("[mining] click:worker_check_end", { alive: workerAlive })
    } catch (error) {
      console.error("[mining] click:worker_check_error", error)
    }

    // Redis status lookup can hang => timeout and fallback
    let existingStatus: MiningRequestStatus | null = null
    try {
      console.info("[mining] click:redis_status_start", { idempotencyKey })
      existingStatus = await withTimeout(getMiningRequestStatus(idempotencyKey), REDIS_TIMEOUT_MS, "getMiningRequestStatus")
      console.info("[mining] click:redis_status_end", { found: Boolean(existingStatus) })
    } catch (e) {
      console.warn("Redis status lookup timed out", e)
      return respond(
        NextResponse.json(
          { error: "Mining is temporarily unavailable. Please try again.", retryAfterSeconds: 2 },
          {
            status: 503,
            headers: {
              "Idempotency-Key": idempotencyKey,
              "Retry-After": "2",
              "Cache-Control": NO_STORE,
            },
          },
        ),
        { outcome: "status_timeout" },
      )
    }

    if (existingStatus) {
      if (existingStatus.userId !== userPayload.userId) {
        return respond(
          NextResponse.json(
            { error: "Idempotency key belongs to another user" },
            { status: 409, headers: { "Idempotency-Key": idempotencyKey, "Cache-Control": NO_STORE } },
          ),
          { outcome: "idempotency_conflict" },
        )
      }
      return respond(buildStatusResponse(existingStatus, request), { outcome: "duplicate" })
    }

    // Enqueue can hang => timeout and fallback
    try {
      console.info("[mining] click:enqueue_start", { idempotencyKey })
      const enqueueResult = await withTimeout(
        enqueueMiningRequest({
          userId: userPayload.userId,
          idempotencyKey,
          sourceIp: ip,
          userAgent: request.headers.get("user-agent"),
        }),
        REDIS_TIMEOUT_MS,
        "enqueueMiningRequest",
      )

      console.info("[mining] click:enqueue_end", {
        idempotencyKey,
        enqueued: enqueueResult.enqueued,
        status: enqueueResult.status.status,
      })

      // バ. If worker is not alive, process inline as a bounded fallback so users still finish
      if (!workerAlive && enqueueResult.status.status === "queued") {
        console.warn("[mining] click:inline_fallback_start", { idempotencyKey })
        try {
          await markMiningStatusProcessing(idempotencyKey)
          const result = await withTimeout(
            performMiningClick(userPayload.userId, { idempotencyKey }),
            INLINE_MINING_TIMEOUT_MS,
            "inline_performMiningClick",
          )
          await markMiningStatusCompleted(idempotencyKey, userPayload.userId, {
            ...result,
            message: "Mining rewarded",
            completedAt: new Date().toISOString(),
          })

          const completedStatus: MiningRequestStatus = {
            status: "completed",
            idempotencyKey,
            userId: userPayload.userId,
            requestedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            result,
          }
          console.info("[mining] click:inline_fallback_success", { idempotencyKey })
          return respond(buildStatusResponse(completedStatus, request, { "X-Worker-Fallback": "inline" }), {
            outcome: "inline_completed",
          })
        } catch (error: any) {
          console.error("[mining] click:inline_fallback_error", error)
          const isActionError = error instanceof MiningActionError
          await markMiningStatusFailed(idempotencyKey, userPayload.userId, {
            message: isActionError ? error.message : "Unexpected mining error",
            retryable: !isActionError || (isActionError && error.status >= 500),
            details: (error as any)?.details,
          })
          const statusCode = isActionError && error.status ? error.status : 503
          return respond(
            NextResponse.json(
              {
                error: isActionError ? error.message : "Mining failed. Please try again.",
                ...(error as any)?.details,
              },
              {
                status: statusCode,
                headers: { "Idempotency-Key": idempotencyKey, "Cache-Control": NO_STORE },
              },
            ),
            { outcome: "inline_failure" },
          )
        }
      }

      return respond(buildStatusResponse(enqueueResult.status, request, { "X-Worker-Alive": String(workerAlive) }), {
        outcome: workerAlive ? "enqueued" : "enqueued_no_worker",
      })
    } catch (error) {
      console.error("Mining click enqueue error/timeout", error)
      return respond(
        NextResponse.json(
          { error: "Unable to queue mining request. Please try again.", retryAfterSeconds: 3 },
          {
            status: 503,
            headers: {
              "Idempotency-Key": idempotencyKey,
              "Retry-After": "3",
              "Cache-Control": NO_STORE,
            },
          },
        ),
        { outcome: "enqueue_failure" },
      )
    }
  }

  const hardTimeoutPromise = new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      console.error("[mining] click:hard_timeout", { path })
      resolve(
        respond(
          NextResponse.json(
            { error: "Mining request timed out. Please retry.", retryAfterSeconds: 3 },
            {
              status: 503,
              headers: {
                "Retry-After": "3",
                "Cache-Control": NO_STORE,
              },
            },
          ),
          { outcome: "hard_timeout" },
        ),
      )
    }, HARD_RESPONSE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([mainFlow(), hardTimeoutPromise])
  } catch (error) {
    console.error("[mining] click:unhandled_error", error)
    return respond(
      NextResponse.json(
        { error: "Unexpected mining error", retryAfterSeconds: 3 },
        { status: 503, headers: { "Retry-After": "3", "Cache-Control": NO_STORE } },
      ),
      { outcome: "unhandled_error" },
    )
  }
}
