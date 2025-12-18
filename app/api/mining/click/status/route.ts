import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getMiningRequestStatus, MiningStatusUnavailableError } from "@/lib/services/mining-queue"
import { enforceUnifiedRateLimit, getRateLimitContext } from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"

export const runtime = "nodejs"

const STATUS_LOOKUP_TIMEOUT_MS = Number(process.env.MINING_STATUS_READ_TIMEOUT_MS ?? 8000)

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

export async function GET(request: NextRequest) {
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

  const key = new URL(request.url).searchParams.get("key")?.trim()
  if (!key) {
    return json({ error: "Missing idempotency key" }, { status: 400 }, { outcome: "missing_idempotency" })
  }

  let status
  try {
    status = await withTimeout(getMiningRequestStatus(key), STATUS_LOOKUP_TIMEOUT_MS, "status-read")
  } catch (err) {
    console.error("Mining click status timeout/error:", err)
    if (isTimeoutError(err) || err instanceof MiningStatusUnavailableError) {
      return json(
        { error: "Status temporarily unavailable. Please retry shortly." },
        { status: 503, headers: { "Retry-After": "3", "Cache-Control": "no-store" } },
        { outcome: "status_unavailable" },
      )
    }

    return json({ error: "Status check failed" }, { status: 500 }, { outcome: "status_error" })
  }

  if (!status || status.userId !== user.userId) {
    return json({ error: "Status not found" }, { status: 404 }, { outcome: "not_found" })
  }

  const normalizedStatus =
    status.status === "completed"
      ? { ...status, result: { message: "Rewarded", ...(status.result ?? {}) } }
      : status

  const headers: Record<string, string> = { "Cache-Control": "no-store" }
  let statusCode = 202

  if (normalizedStatus.status === "queued" || normalizedStatus.status === "processing") {
    if (normalizedStatus.queueDepth !== undefined) headers["X-Queue-Depth"] = String(normalizedStatus.queueDepth)
  }

  if (normalizedStatus.status === "completed") {
    statusCode = 200
  } else if (normalizedStatus.status === "failed") {
    statusCode = normalizedStatus.error?.retryable ? 503 : 409
    if (normalizedStatus.error?.retryAfterMs) {
      const retrySeconds = Math.max(1, Math.ceil(normalizedStatus.error.retryAfterMs / 1000))
      headers["Retry-After"] = retrySeconds.toString()
      headers["X-Backoff-Hint"] = Math.min(600, Math.pow(2, Math.ceil(Math.log2(retrySeconds)))).toString()
    }
  }

  return json({ status: normalizedStatus }, { status: statusCode, headers }, { outcome: normalizedStatus.status })
}
