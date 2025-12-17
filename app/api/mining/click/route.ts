import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import {
  getMiningRequestStatus,
  markMiningStatusCompleted,
  markMiningStatusFailed,
  markMiningStatusProcessing,
  MINING_STATUS_TTL_MS,
  type MiningRequestStatus,
} from "@/lib/services/mining-queue"
import { MiningActionError, performMiningClick } from "@/lib/services/mining"
import { recordMiningMetrics } from "@/lib/services/mining-metrics"
import { getClientIp, getRateLimitContext } from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = "no-store"
const PROCESS_TIMEOUT_MS = 3500

function makeIdempotencyKey() {
  const g = globalThis as any
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID()
  return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(id))
  })
}

function buildStatusResponse(
  status: MiningRequestStatus,
  request: NextRequest,
  extraHeaders: Record<string, string> = {},
): NextResponse<{ status: MiningRequestStatus; statusUrl: string }> {
  const statusUrl = new URL("/api/mining/click", request.url)
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
    headers["Cache-Control"] = `private, max-age=0, s-maxage=${Math.floor(MINING_STATUS_TTL_MS / 1000)}`
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
    recordRequestLatency("backend", Date.now() - startedAt, { path, status: response.status, ...tags })
    return response
  }

  const user = getUserFromRequest(request)
  if (!user) {
    return respond(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), { outcome: "unauthorized" })
  }

  let idempotencyKey =
    request.headers.get("Idempotency-Key")?.trim() || request.headers.get("idempotency-key")?.trim() || ""
  if (!idempotencyKey) idempotencyKey = makeIdempotencyKey()

  const ip = getClientIp(request)

  // Idempotent lookup first
  const prior = await getMiningRequestStatus(idempotencyKey)
  if (prior && prior.userId === user.userId) {
    return respond(buildStatusResponse(prior, request), { outcome: "duplicate" })
  }

  // Process inline with bounded timeout; record minimal status best-effort
  try {
    await markMiningStatusProcessing(idempotencyKey).catch(() => null)

    const result = await withTimeout(
      performMiningClick(user.userId, { idempotencyKey }),
      PROCESS_TIMEOUT_MS,
      "performMiningClick",
    )

    await recordMiningMetrics({
      processed: 1,
      profitTotal: result.profit,
      roiCapReached: result.roiCapReached ? 1 : 0,
    }).catch(() => null)

    const status = await markMiningStatusCompleted(idempotencyKey, user.userId, {
      ...result,
      message: "Mining rewarded",
      completedAt: new Date().toISOString(),
    }).catch(() => {
      const now = new Date().toISOString()
      return {
        status: "completed" as const,
        idempotencyKey,
        userId: user.userId,
        requestedAt: now,
        updatedAt: now,
        result,
      }
    })

    return respond(
      buildStatusResponse(status, request, {
        "X-RateLimit-Layer": "bypass",
        "X-Mining-Mode": "inline",
        "X-Client-Ip": ip ?? "",
      }),
      { outcome: "completed" },
    )
  } catch (error: any) {
    if (error instanceof MiningActionError) {
      const status = await markMiningStatusFailed(idempotencyKey, user.userId, {
        message: error.message,
        retryable: error.status >= 500,
        details: (error as any).details,
      }).catch(() => null)

      return respond(
        NextResponse.json(
          { error: error.message, ...(error as any)?.details },
          { status: error.status, headers: { "Idempotency-Key": idempotencyKey, "Cache-Control": NO_STORE } },
        ),
        { outcome: "mining_error", status: status?.status ?? "failed" },
      )
    }

    console.error("[mining] click:inline_unexpected", error)
    const status = await markMiningStatusFailed(idempotencyKey, user.userId, {
      message: "Mining temporarily unavailable",
      retryable: true,
      retryAfterMs: 3000,
    }).catch(() => null)

    return respond(
      NextResponse.json(
        { error: "Mining temporarily unavailable. Please retry.", retryAfterSeconds: 3 },
        {
          status: 503,
          headers: {
            "Idempotency-Key": idempotencyKey,
            "Retry-After": "3",
            "Cache-Control": NO_STORE,
          },
        },
      ),
      { outcome: "inline_failure", status: status?.status ?? "failed" },
    )
  }
}

// Status GET (for compatibility; reuses same route)
export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    recordRequestLatency("backend", Date.now() - startedAt, { path, status: response.status, ...tags })
    return response
  }

  const user = getUserFromRequest(request)
  if (!user) {
    return respond(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), { outcome: "unauthorized" })
  }

  const key = new URL(request.url).searchParams.get("key")?.trim()
  if (!key) {
    return respond(NextResponse.json({ error: "Missing idempotency key" }, { status: 400 }), {
      outcome: "missing_idempotency",
    })
  }

  const status = await getMiningRequestStatus(key)
  if (!status || status.userId !== user.userId) {
    return respond(NextResponse.json({ error: "Status not found" }, { status: 404 }), { outcome: "not_found" })
  }

  return respond(buildStatusResponse(status, request), { outcome: status.status })
}
