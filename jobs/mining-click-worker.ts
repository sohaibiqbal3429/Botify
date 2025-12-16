import "dotenv/config"

import { createMiningClickWorker } from "@/lib/queues/mining-clicks"
import { recordMiningMetrics } from "@/lib/services/mining-metrics"
import {
  heartbeatMiningWorker,
  isMiningWorkerAlive,
  markMiningStatusCompleted,
  markMiningStatusFailed,
  markMiningStatusProcessing,
} from "@/lib/services/mining-queue"
import { MiningActionError, performMiningClick } from "@/lib/services/mining"

const worker = createMiningClickWorker(async (job) => {
  const { idempotencyKey, userId } = job.data

  await markMiningStatusProcessing(idempotencyKey)

  try {
    const result = await performMiningClick(userId, { idempotencyKey })
    await markMiningStatusCompleted(idempotencyKey, userId, {
      ...result,
      message: "Mining rewarded",
      completedAt: new Date().toISOString(),
    })

    await recordMiningMetrics({
      processed: 1,
      profitTotal: result.profit,
      roiCapReached: result.roiCapReached ? 1 : 0,
    })

    return result
  } catch (error) {
    if (error instanceof MiningActionError) {
      await markMiningStatusFailed(
        idempotencyKey,
        userId,
        {
          message: error.message,
          retryable: error.status >= 500,
          details: (error as any).details,
        },
      )

      await recordMiningMetrics({ failed: 1 })
      if (error.status >= 500) {
        throw error
      }

      return { error: error.message }
    }

    await markMiningStatusFailed(idempotencyKey, userId, {
      message: "Unexpected mining error",
      retryable: true,
    })
    await recordMiningMetrics({ failed: 1 })

    throw error
  }
})

if (!worker) {
  console.warn("[mining-worker] Worker not started (Redis disabled). Mining clicks will not be processed.")
} else {
  const startHeartbeat = async () => {
    try {
      await heartbeatMiningWorker()
    } catch (err) {
      console.error("[mining-worker] heartbeat failed", err)
    }
  }

  // バ. keep lightweight heartbeat to let API detect worker presence
  void startHeartbeat()
  const interval = setInterval(startHeartbeat, 20_000)
  interval.unref?.()

  worker.on("closed", async () => {
    try {
      const alive = await isMiningWorkerAlive()
      if (!alive) console.warn("[mining-worker] worker closed; heartbeat stale")
    } catch (err) {
      console.error("[mining-worker] post-close heartbeat check failed", err)
    }
  })
}
