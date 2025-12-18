import Redis, { type RedisOptions } from "ioredis"

let redisClient: Redis | null = null

function createRedisClient(): Redis {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL must be configured to use Redis-backed features")
  }

  const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 2000)
  const commandTimeout = Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 3000)

  const options: RedisOptions = {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 1,
    connectTimeout,
    commandTimeout,
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

export type RedisClient = ReturnType<typeof getRedisClient>
