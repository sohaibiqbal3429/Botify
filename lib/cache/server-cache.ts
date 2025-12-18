import { isRedisEnabled, getRedisClient } from "@/lib/redis"

const memoryStore: Map<string, { expiresAt: number; value: unknown }> = new Map()

interface CacheResult<T> {
  value: T
  hitLayer: "memory" | "redis" | "miss"
}

function setMemory(key: string, ttlSeconds: number, value: unknown) {
  const expiresAt = Date.now() + ttlSeconds * 1000
  memoryStore.set(key, { expiresAt, value })
}

function getMemory<T>(key: string): CacheResult<T> | null {
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key)
    return null
  }
  return { value: entry.value as T, hitLayer: "memory" }
}

export async function getCachedJSON<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<CacheResult<T>> {
  const memoryHit = getMemory<T>(key)
  if (memoryHit) return memoryHit

  if (isRedisEnabled()) {
    try {
      const client = getRedisClient()
      const cached = await client.get(key)
      if (cached) {
        const parsed = JSON.parse(cached) as T
        setMemory(key, ttlSeconds, parsed)
        return { value: parsed, hitLayer: "redis" }
      }
    } catch (error) {
      console.warn(`[cache] Redis read failed for ${key}`, error)
    }
  }

  const value = await compute()
  setMemory(key, ttlSeconds, value)

  if (isRedisEnabled()) {
    try {
      const client = getRedisClient()
      await client.set(key, JSON.stringify(value), "EX", ttlSeconds)
    } catch (error) {
      console.warn(`[cache] Redis write failed for ${key}`, error)
    }
  }

  return { value, hitLayer: "miss" }
}
