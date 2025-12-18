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
      const result = await performMiningClick(user.userId, { idempotencyKey })

      return json(
        {
          idempotencyKey,
          statusUrl: makeStatusUrl(), // ✅ include for consistency
          status: {
            status: "completed" as const,
            idempotencyKey,
            userId: user.userId,
            requestedAt,
            updatedAt: new Date().toISOString(),
            result: {
              ...result,
              message: "Mining rewarded",
            },
          },
        },
        { status: 200 },
        { outcome: "inline_completed" },
      )
    } catch (err: any) {
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

      return json(
        { status: existing, statusUrl: makeStatusUrl(), idempotencyKey },
        { status: statusCode, headers },
        { outcome: `existing_${existing.status}` },
      )
    }

    const { status } = await enqueueMiningRequest({
      userId: user.userId,
      idempotencyKey,
    })

    const headers: Record<string, string> = { "Cache-Control": "no-store" }
    if (status.queueDepth !== undefined) headers["X-Queue-Depth"] = String(status.queueDepth)

    return json(
      { status, statusUrl: makeStatusUrl(), idempotencyKey },
      { status: status.status === "completed" ? 200 : 202, headers },
      { outcome: status.status },
    )
  } catch (err: any) {
    console.error("[mining/click] enqueue failed:", err)
    if (err instanceof MiningStatusUnavailableError) {
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
