"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

  const [polling, setPolling] = useState<null | { url: string }>(null)
  const pollStartedAtRef = useRef(0)

  useEffect(() => setCanMine(mining.canMine), [mining.canMine])

  const handleMining = useCallback(async () => {
    setFeedback({})
    setIsLoading(true)

    const idempotencyKey = makeIdempotencyKey()

    try {
      const res = await fetch("/api/mining/click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey, // ✅ use the generated one
        },
        cache: "no-store",
      })

      const data = await res.json().catch(() => ({}))

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
        pollStartedAtRef.current = Date.now()
        setPolling({ url: statusUrl })
        setFeedback({ success: "Mining queued..." })
        return
      }

      setFeedback({ error: data?.error || "Unable to start mining. Please try again." })
    } catch {
      setFeedback({ error: "Network error. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }, [onMiningSuccess, router])

  useEffect(() => {
    if (!polling) return
    let cancelled = false

    const tick = async () => {
      try {
        if (Date.now() - pollStartedAtRef.current > POLL_MAX_MS) {
          setFeedback({ error: "Mining timed out. Please try again." })
          setPolling(null)
          return
        }

        const res = await fetch(polling.url, { method: "GET", cache: "no-store" })
        const data = await res.json().catch(() => ({}))
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
          setFeedback({ success: queueDepth ? `Mining queued. Position ~${queueDepth}` : "Mining processing..." })
          return
        }

        setFeedback({ error: data?.error || "Mining failed. Please try again." })
        setPolling(null)
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
  }, [polling, onMiningSuccess, router])

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

      <div className="text-slate-300">Cycle yieldd: ${Number(mining.earnedInCycle ?? 0).toFixed(2)}</div>
    </div>
  )
}
