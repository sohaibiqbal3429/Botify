"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type FeedbackState = { success?: string; error?: string }

export interface MiningWidgetProps {
  mining: {
    canMine: boolean
    nextEligibleAt: string
    earnedInCycle: number
  }
  onMiningSuccess?: () => void
}

const POLL_INTERVAL_MS = 1500
const POLL_MAX_MS = 45_000

function makeIdempotencyKey() {
  // Prefer stable per-click UUID when available
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>({})
  const [canMine, setCanMine] = useState(mining.canMine)

  const [polling, setPolling] = useState<null | { url: string; idempotencyKey: string }>(null)
  const pollStartedAtRef = useRef(0)

  useEffect(() => setCanMine(mining.canMine), [mining.canMine])

  const resetState = useCallback(() => {
    setFeedback({})
    setPolling(null)
    setIsLoading(false)
  }, [])

  const parseJsonSafely = useCallback(async (response: Response) => {
    const contentType = response.headers.get("content-type") || ""
    if (!contentType.toLowerCase().includes("application/json")) {
      return null
    }

    try {
      return await response.json()
    } catch {
      return null
    }
  }, [])

  const statusCopy = useMemo(() => {
    if (!polling) return ""
    return polling.idempotencyKey ? ` (ref ${polling.idempotencyKey.slice(0, 8)})` : ""
  }, [polling])

  const handleMining = useCallback(async () => {
    resetState()
    setIsLoading(true)

    const idempotencyKey = makeIdempotencyKey()
    const startPolling = (statusUrl: string, message?: string) => {
      pollStartedAtRef.current = Date.now()
      setPolling({ url: statusUrl, idempotencyKey })
      if (message) setFeedback({ success: message })
    }

    try {
      const res = await fetch("/api/mining/click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey, // ✅ use the generated one
        },
        cache: "no-store",
      })

      const data = (await parseJsonSafely(res)) ?? {}

      if (res.status === 200) {
        setFeedback({ success: data?.status?.result?.message ?? "Mining successful!" })
        setCanMine(false)
        router.refresh()
        onMiningSuccess?.()
        return
      }

      if (res.status === 202) {
        const statusUrl = typeof data?.statusUrl === "string" ? data.statusUrl : ""
        if (!statusUrl) {
          setFeedback({ error: "Server did not return statusUrl." })
          return
        }
        startPolling(statusUrl, undefined)
        const queueDepth = res.headers.get("X-Queue-Depth")
        setFeedback({ success: queueDepth ? `Mining queued. Position ~${queueDepth}` : "Mining queued..." })
        return
      }

      if (res.status === 504) {
        const fallbackStatusUrl = `/api/mining/click/status?key=${encodeURIComponent(idempotencyKey)}`
        startPolling(fallbackStatusUrl, "Request timed out. Checking status...")
        return
      }

      const fallbackError = data?.error || `Unable to start mining. (${res.status})`
      setFeedback({ error: fallbackError })
    } catch {
      setFeedback({ error: "Network error. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }, [onMiningSuccess, parseJsonSafely, resetState, router])

  useEffect(() => {
    if (!polling) return
    let cancelled = false

    const tick = async () => {
      try {
        if (Date.now() - pollStartedAtRef.current > POLL_MAX_MS) {
          setFeedback({ error: "Mining timed out. Please try again." })
          setPolling(null)
          setIsLoading(false)
          return
        }

        const res = await fetch(polling.url, { method: "GET", cache: "no-store" })
        const data = (await parseJsonSafely(res)) ?? {}
        if (cancelled) return

        if (res.status === 200) {
          setFeedback({ success: data?.status?.result?.message ?? "Mining successful!" })
          setCanMine(false)
          setPolling(null)
          router.refresh()
          onMiningSuccess?.()
          return
        }

        if (res.status === 202) {
          const queueDepth = res.headers.get("X-Queue-Depth")
          const phase = data?.status?.status === "processing" ? "Processing" : "Queued"
          setFeedback({ success: queueDepth ? `${phase}. Position ~${queueDepth}${statusCopy}` : `${phase}...${statusCopy}` })
          return
        }

        if (res.status === 409 || res.status === 503) {
          const retryAfter = res.headers.get("Retry-After")
          const suffix = retryAfter ? ` Please retry in ~${retryAfter}s.` : ""
          setFeedback({ error: `${data?.error ?? "Mining temporarily unavailable."}${suffix}` })
          setPolling(null)
          setIsLoading(false)
          return
        }

        setFeedback({ error: data?.error || `Mining failed (status ${res.status}).` })
        setPolling(null)
        setIsLoading(false)
      } catch {
        // ignore transient polling errors
      }
    }

    const i = setInterval(tick, POLL_INTERVAL_MS)
    tick()

    return () => {
      cancelled = true
      clearInterval(i)
    }
  }, [polling, onMiningSuccess, parseJsonSafely, router, statusCopy])

  return (
    <div className="space-y-3">
      {feedback.error ? <div className="text-red-500">{feedback.error}</div> : null}
      {feedback.success ? <div className="text-emerald-400">{feedback.success}</div> : null}

      <button
        onClick={handleMining}
        disabled={!canMine || isLoading || !!polling}
        className="rounded-xl bg-emerald-500 px-4 py-2 text-black disabled:opacity-60"
      >
        {isLoading ? "Starting..." : polling ? "Working..." : "Start Boost Cycle"}
      </button>

      <div className="text-slate-300">Cycle yield: ${Number(mining.earnedInCycle ?? 0).toFixed(2)}</div>
    </div>
  )
}
