import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getClientIp } from "@/lib/rate-limit/unified" // using only the IP helper (NO rate limiting)
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"

import { MiningActionError, performMiningClick } from "@/lib/services/mining"
import { recordMiningMetrics } from "@/lib/services/mining-metrics"

import {
  MINING_STATUS_TTL_MS,
  type MiningRequestStatus,
} from "@/lib/services/mining-queue"

/**
 * Keep the response format your UI expects: { status, statusUrl }
 */
function buildStatusResponse(
  status: MiningRequestStatus,
  request: NextRequest,
): NextResponse<{ status: MiningRequestStatus; statusUrl: string }> {
  const statusUrl = new URL("/api/mining/click/status", request.url)
  statusUrl.searchParams.set("key", status.idempotencyKey)

  let statusCode = 202
  const headers: Record<string, string> = { "Cache-Control": "no-store" }

  if (status.status === "queued" || status.status === "processing") {
    if (status.queueDepth !== undefined) headers["X-Queue-Depth"] = String(status.queueDepth)
  } else if (status.status === "completed") {
    statusCode = 200
    headers["Cache-Control"] = `private, max-age=0, s-maxage=${Math.floor(
      MINING_STATUS_TTL_MS / 1000,
    )}`
  } else {
    // error statuses
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
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    recordRequestLatency("backend", Date.now() - startedAt, {
      path,
      status: response.status,
      ...tags,
    })
    return response
  }

  // REQUIRED: protect against double-click / retries
  const idempotencyKey = request.headers.get("idempotency-key")?.trim()
  if (!idempotencyKey) {
    return respond(
      NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 }),
      { outcome: "missing_idempotency" },
    )
  }

  const userPayload = getUserFromRequest(request)
  if (!userPayload) {
    return respond(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), {
      outcome: "unauthorized",
    })
  }

  const ip = getClientIp(request)

  // ✅ Always reward immediately (no rate-limit, no queue)
  try {
    const requestedAt = new Date()
    const result = await performMiningClick(userPayload.userId, { idempotencyKey })
    const completedAt = new Date()

    // Metrics must NEVER break mining reward
    try {
      await recordMiningMetrics({
        processed: 1,
        profitTotal: result.profit,
        roiCapReached: result.roiCapReached ? 1 : 0,
      })
    } catch (metricsErr) {
      console.warn("recordMiningMetrics failed (ignored):", metricsErr)
    }

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
        message: "Mining rewarded",
        completedAt: completedAt.toISOString(),
      },
    }

    return respond(buildStatusResponse(status, request), { outcome: "completed_direct" })
  } catch (error) {
    // If your mining service intentionally blocks (cooldown/KYC/etc), it should throw MiningActionError
    if (error instanceof MiningActionError) {
      return respond(NextResponse.json({ error: error.message }, { status: error.status }), {
        outcome: "mining_error",
      })
    }

    console.error("Mining click processing error", error)
    return respond(
      NextResponse.json({ error: "Unable to process mining request" }, { status: 500 }),
      { outcome: "processing_failure" },
    )
  }
}
