import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getMiningRequestStatus, type MiningRequestStatus } from "@/lib/services/mining-queue"
import { enforceUnifiedRateLimit, getRateLimitContext } from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"
import { isRedisEnabled } from "@/lib/redis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REDIS_TIMEOUT_MS = 1200
const NO_STORE = "no-store"
const HARD_RESPONSE_TIMEOUT_MS = 1500

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    promise
      .then((v) => resolve(v))
      .catch((e) => reject(e))
      .finally(() => clearTimeout(id))
  })
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  const rateContext = getRateLimitContext(request)
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    console.info("[mining] status:return", { path, status: response.status, tags, latencyMs: Date.now() - startedAt })
    recordRequestLatency("backend", Date.now() - startedAt, { path, status: response.status, ...tags })
    return response
  }

  console.info("[mining] status:start", { path })

  const mainFlow = async (): Promise<NextResponse> => {
    try {
      const decision = await withTimeout(
        enforceUnifiedRateLimit("backend", rateContext, { path }),
        REDIS_TIMEOUT_MS,
        "rate_limit",
      )
      if (!decision.allowed && decision.response) {
        return respond(decision.response, { outcome: "rate_limited" })
      }
    } catch (error) {
      console.error("[mining] status:rate_limit_timeout", error)
      return respond(
        NextResponse.json(
          { error: "Status temporarily unavailable. Please retry.", retryAfterSeconds: 2 },
          { status: 503, headers: { "Cache-Control": NO_STORE, "Retry-After": "2" } },
        ),
        { outcome: "rate_limit_timeout" },
      )
    }

    const user = getUserFromRequest(request)
    if (!user) {
      return respond(
        NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": NO_STORE } }),
        {
          outcome: "unauthorized",
        },
      )
    }

    const key = new URL(request.url).searchParams.get("key")?.trim()
    if (!key) {
      return respond(
        NextResponse.json({ error: "Missing idempotency key" }, { status: 400, headers: { "Cache-Control": NO_STORE } }),
        {
          outcome: "missing_idempotency",
        },
      )
    }

    if (!isRedisEnabled()) {
      return respond(
        NextResponse.json(
          { error: "Mining status is temporarily unavailable. Please try again shortly." },
          { status: 503, headers: { "Cache-Control": NO_STORE, "X-Backoff-Hint": "8" } },
        ),
        { outcome: "redis_unavailable" },
      )
    }

    let status: MiningRequestStatus | null = null
    try {
      console.info("[mining] status:redis_status_start", { key })
      status = await withTimeout(getMiningRequestStatus(key), REDIS_TIMEOUT_MS, "getMiningRequestStatus")
      console.info("[mining] status:redis_status_end", { hit: Boolean(status) })
    } catch (error) {
      console.error("[mining] status:redis_timeout", error)
      return respond(
        NextResponse.json(
          { error: "Status lookup timed out. Please retry.", retryAfterSeconds: 2 },
          { status: 503, headers: { "Cache-Control": NO_STORE, "Retry-After": "2" } },
        ),
        { outcome: "status_timeout" },
      )
    }

    if (!status || status.userId !== user.userId) {
      return respond(
        NextResponse.json({ error: "Status not found" }, { status: 404, headers: { "Cache-Control": NO_STORE } }),
        {
          outcome: "not_found",
        },
      )
    }

    const headers: Record<string, string> = { "Cache-Control": NO_STORE, "Idempotency-Key": status.idempotencyKey }
    let statusCode = 202

    if (status.status === "queued" || status.status === "processing") {
      if (status.queueDepth !== undefined) {
        headers["X-Queue-Depth"] = String(status.queueDepth)
      }
    }

    if (status.status === "completed") {
      statusCode = 200
    } else if (status.status === "failed") {
      statusCode = status.error?.retryable ? 503 : 409
      if (status.error?.retryAfterMs) {
        const retrySeconds = Math.max(1, Math.ceil(status.error.retryAfterMs / 1000))
        headers["Retry-After"] = retrySeconds.toString()
        const backoffSeconds = Math.min(600, Math.pow(2, Math.ceil(Math.log2(retrySeconds))))
        headers["X-Backoff-Hint"] = backoffSeconds.toString()
      }
    }

    return respond(
      NextResponse.json(
        { status },
        {
          status: statusCode,
          headers,
        },
      ),
      { outcome: status.status },
    )
  }

  const hardTimeoutPromise = new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      console.error("[mining] status:hard_timeout", { path })
      resolve(
        respond(
          NextResponse.json(
            { error: "Status request timed out. Please retry.", retryAfterSeconds: 2 },
            { status: 503, headers: { "Cache-Control": NO_STORE, "Retry-After": "2" } },
          ),
          { outcome: "hard_timeout" },
        ),
      )
    }, HARD_RESPONSE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([mainFlow(), hardTimeoutPromise])
  } catch (error) {
    console.error("[mining] status:unhandled_error", error)
    return respond(
      NextResponse.json(
        { error: "Unexpected status error", retryAfterSeconds: 2 },
        { status: 503, headers: { "Cache-Control": NO_STORE, "Retry-After": "2" } },
      ),
      { outcome: "unhandled_error" },
    )
  }
}
