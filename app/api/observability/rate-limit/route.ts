import { NextResponse } from "next/server"

import { getRateLimitTelemetrySnapshot } from "@/lib/observability/request-metrics"

export function GET() {
  const windowMs = 60_000
  const snapshot = getRateLimitTelemetrySnapshot({ windowMs })

  const observabilityEnabled =
    (process.env.NEXT_PUBLIC_ENABLE_OBSERVABILITY_IN_BROWSER ??
      process.env.ENABLE_OBSERVABILITY_IN_BROWSER ??
      "false")
      .toString()
      .toLowerCase()
      .trim() === "true"

  if (!observabilityEnabled) {
    return NextResponse.json(
      { windowMs, lastUpdated: new Date().toISOString(), layers: [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
          "X-Observability-Disabled": "true",
        },
      },
    )
  }

  return NextResponse.json(
    {
      windowMs,
      lastUpdated: new Date().toISOString(),
      layers: snapshot.map((layer) => ({
        layer: layer.layer,
        requestRatePerSecond: layer.requestRatePerSecond,
        throttleEventsLastWindow: layer.throttleEventsLastWindow,
        p95LatencyMs: layer.p95LatencyMs,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=15, stale-while-revalidate=45",
      },
    },
  )
}
