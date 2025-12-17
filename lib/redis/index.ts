import Redis, { type RedisOptions } from "ioredis"

let redisClient: Redis | null = null

function createRedisClient(): Redis {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL must be configured to use Redis-backed features")
  }

  const options: RedisOptions = {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT ?? 1500),
    retryStrategy(times) {
      const delay = Math.min(times * 100, 2000)
      return delay
    },
  }

  return new Redis(process.env.REDIS_URL, options)
}

export function isRedisEnabled(): boolean {
  return Boolean(process.env.REDIS_URL)
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient()

    redisClient.on("error", (error) => {
      console.error("[redis] connection error", error)
    })
  }

  return redisClient
}

export async function ensureRedisConnected(): Promise<void> {
  if (!redisClient) return
  if ((redisClient as any).status === "ready") return
  try {
    await redisClient.connect()
  } catch (error) {
    console.warn("[redis] failed to connect", error)
  }
}

export type RedisClient = ReturnType<typeof getRedisClient>
