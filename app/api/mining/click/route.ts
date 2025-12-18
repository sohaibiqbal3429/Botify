import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { enforceUnifiedRateLimit, getRateLimitContext } from "@/lib/rate-limit/unified"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"
import { getMiningRequestStatus, enqueueMiningRequest } from "@/lib/services/mining-queue"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const path = new URL(request.url).pathname
  const rateContext = getRateLimitContext(request)
  trackRequestRate("backend", { path })

  const respond = (response: NextResponse, tags: Record<string, string | number> = {}) => {
    recordRequestLatency("backend", Date.now() - startedAt, { path, status: response.status, ...tags })
    return response
  }

  const rateDecision = await enforceUnifiedRateLimit("backend", rateContext, { path })
  if (!rateDecision.allowed && rateDecision.response) {
    return respond(rateDecision.response, { outcome: "rate_limited" })
  }

  const user = getUserFromRequest(request)
  if (!user) {
    return respond(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), { outcome: "unauthorized" })
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim()
  if (!idempotencyKey) {
    return respond(NextResponse.json({ error: "Missing idempotency key" }, { status: 400 }), {
      outcome: "missing_idempotency",
    })
  }

  const makeStatusUrl = () => {
    const u = new URL("/api/mining/click/status", request.url)
    u.searchParams.set("key", idempotencyKey)
    return u.toString()
  }

  const existing = await getMiningRequestStatus(idempotencyKey)
  if (existing && existing.userId === user.userId) {
    const headers: Record<string, string> = { "Cache-Control": "no-store" }
    if (existing.queueDepth !== undefined) headers["X-Queue-Depth"] = String(existing.queueDepth)

    const statusCode =
      existing.status === "completed"
        ? 200
        : existing.status === "failed"
          ? existing.error?.retryable
            ? 503
            : 409
          : 202

    return respond(
      NextResponse.json({ status: existing, statusUrl: makeStatusUrl() }, { status: statusCode, headers }),
      { outcome: `existing_${existing.status}` },
    )
  }

  // ✅ UPDATED: submitMiningRequest -> enqueueMiningRequest (and destructure { status })
  const { status } = await enqueueMiningRequest({
    userId: user.userId,
    idempotencyKey,
  })

  const headers: Record<string, string> = { "Cache-Control": "no-store" }
  if (status.queueDepth !== undefined) headers["X-Queue-Depth"] = String(status.queueDepth)

  return respond(
    NextResponse.json(
      { status, statusUrl: makeStatusUrl() },
      { status: status.status === "completed" ? 200 : 202, headers },
    ),
    { outcome: status.status },
  )
}
