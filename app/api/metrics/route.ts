import { NextResponse } from "next/server"
import { performance, monitorEventLoopDelay } from "perf_hooks"

const histogram = monitorEventLoopDelay()
histogram.enable()

export async function GET() {
  const started = performance.now()
  const mem = process.memoryUsage()

  const payload = {
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    eventLoopDelayMs: Number(histogram.mean / 1_000_000),
    timestamp: new Date().toISOString(),
    latencyMs: Number((performance.now() - started).toFixed(2)),
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
