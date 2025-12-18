import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"
import { getMiningRequestStatus } from "@/lib/services/mining-queue"
import { recordRequestLatency, trackRequestRate } from "@/lib/observability/request-metrics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
    return respond(NextResponse.json({ error: "Status not found" }, { status: 404 }), {
      outcome: "not_found",
    })
  }

  return respond(
    NextResponse.json(
      { status },
      {
        status: status.status === "completed" ? 200 : status.status === "failed" ? 409 : 202,
        headers: { "Cache-Control": "no-store", "Idempotency-Key": status.idempotencyKey },
      },
    ),
    { outcome: status.status },
  )
}
