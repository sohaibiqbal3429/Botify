import { type NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"

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

  // 1) Try to read idempotency key from header
  let idempotencyKey = request.headers.get("Idempotency-Key")?.trim()

  // 2) If not present, try body: { idempotencyKey: "..." }
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

  // 3) Still missing? Generate a deterministic key (per user per day) so UI doesn't break.
  // You can swap this to crypto.randomUUID() if you prefer.
  if (!idempotencyKey) {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    idempotencyKey = `mine:${user.userId}:${today}`
  }

  const makeStatusUrl = () => {
    const u = new URL("/api/mining/click/status", request.url)
    u.searchParams.set("key", idempotencyKey!)
    return u.toString()
  }

  try {
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
        NextResponse.json({ status: existing, statusUrl: makeStatusUrl(), idempotencyKey }, { status: statusCode, headers }),
        { outcome: `existing_${existing.status}` },
      )
    }

    const { status } = await enqueueMiningRequest({
      userId: user.userId,
      idempotencyKey,
    })

    const headers: Record<string, string> = { "Cache-Control": "no-store" }
    if (status.queueDepth !== undefined) headers["X-Queue-Depth"] = String(status.queueDepth)

    return respond(
      NextResponse.json(
        { status, statusUrl: makeStatusUrl(), idempotencyKey },
        { status: status.status === "completed" ? 200 : 202, headers },
      ),
      { outcome: status.status },
    )
  } catch (err: any) {
    console.error("[mining/click] enqueue failed:", err)
    return respond(
      NextResponse.json(
        {
          error: "Unable to start mining",
          detail: err?.message ?? String(err),
          idempotencyKey,
        },
        { status: 500 },
      ),
      { outcome: "exception" },
    )
  }
}
