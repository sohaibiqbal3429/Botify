import { NextResponse } from "next/server"
import { performance } from "perf_hooks"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import { ensureRedisConnected, getRedisClient, isRedisEnabled } from "@/lib/redis"
import { withTimeout } from "@/lib/utils/timeout"

const DB_TIMEOUT_MS = Number(process.env.DB_TIMEOUT_MS ?? 1500)
const REDIS_TIMEOUT_MS = Number(process.env.REDIS_TIMEOUT_MS ?? 800)

export async function GET() {
  const started = performance.now()
  try {
    const mongoCheck = withTimeout(
      (async () => {
        await dbConnect()
        const sample = await User.findOne().select({ _id: 1 }).lean().maxTimeMS(DB_TIMEOUT_MS)
        return { ok: true, sampleUser: sample?._id ?? null }
      })(),
      DB_TIMEOUT_MS,
      "mongo ping",
    )

    const redisCheck = isRedisEnabled()
      ? withTimeout(
          (async () => {
            const client = getRedisClient()
            await ensureRedisConnected()
            const pong = await client.ping()
            return { ok: pong === "PONG" }
          })(),
          REDIS_TIMEOUT_MS,
          "redis ping",
        ).catch((error) => ({ ok: false, error: error?.message ?? "redis ping failed" }))
      : Promise.resolve({ ok: false, disabled: true })

    const [mongoStatus, redisStatus] = await Promise.all([mongoCheck, redisCheck])

    const healthy = mongoStatus.ok && (redisStatus as any).ok !== false

    return NextResponse.json(
      {
        status: healthy ? "healthy" : "degraded",
        mongo: mongoStatus,
        redis: redisStatus,
        latencyMs: Number((performance.now() - started).toFixed(2)),
      },
      {
        status: healthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": healthy ? "0" : "5",
        },
      },
    )
  } catch (error: any) {
    console.error("[health] failed", error)
    return NextResponse.json(
      {
        status: "degraded",
        mongo: { ok: false, error: error?.message ?? "unknown" },
        redis: { ok: false, error: error?.message ?? "unknown" },
      },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    )
  }
}
