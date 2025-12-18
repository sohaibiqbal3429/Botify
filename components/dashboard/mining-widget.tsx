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
const POLL_WARNING_MS = 30_000
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

  const readResponsePayload = useCallback(async (response: Response) => {
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

    if (contentType.includes("application/json")) {
      try {
        const data = await response.json()
        return { data, text: null as string | null }
      } catch {
        // fall through to text read below
      }
    }

    const text = await response.text().catch(() => "")
    return { data: null as any, text }
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
        body: JSON.stringify({ idempotencyKey }),
      })

      const { data, text } = await readResponsePayload(res)
      const deriveStatusUrl = () => {
        const current = res.url ? new URL(res.url, window.location.origin) : new URL("/api/mining/click", window.location.origin)
        current.pathname = current.pathname.replace(/\/$/, "") + "/status"
        current.searchParams.set("key", idempotencyKey)
        return current.toString()
      }

      if (res.status === 200) {
        setFeedback({ success: data?.status?.result?.message ?? "Rewarded ✅" })
        setCanMine(false)
        router.refresh()
        onMiningSuccess?.()
        return
      }

      if (res.status === 202) {
        const statusUrl = typeof data?.statusUrl === "string" ? data.statusUrl : deriveStatusUrl()
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
        startPolling(deriveStatusUrl(), "Request timed out. Checking status...")
        return
      }

      if (res.status === 503 || res.status === 409) {
        const retryAfter = res.headers.get("Retry-After")
        const suffix = retryAfter ? ` Please retry in ~${retryAfter}s.` : ""
        const fallbackError = data?.error || (res.status === 503 ? "Mining temporarily unavailable." : "Mining request conflict.")
        setFeedback({ error: `${fallbackError}${suffix}` })
        return
      }

      const fallbackError =
        data?.error || text?.trim() || `Unable to start mining. (${res.status})`
      setFeedback({ error: fallbackError })
    } catch {
      setFeedback({ error: "Network error. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }, [onMiningSuccess, readResponsePayload, resetState, router])

  useEffect(() => {
    if (!polling) return
    let cancelled = false

    const tick = async () => {
      try {
        const elapsed = Date.now() - pollStartedAtRef.current
        if (elapsed > POLL_MAX_MS) {
          setFeedback({ error: "Mining timed out. Please try again." })
          setPolling(null)
          setIsLoading(false)
          return
        }

        if (elapsed > POLL_WARNING_MS) {
          setFeedback((prev) =>
            prev.error
              ? prev
              : {
                  success: "Mining is still processing. We'll keep checking...",
                },
          )
        }

        const res = await fetch(polling.url, { method: "GET", cache: "no-store" })
        const { data, text } = await readResponsePayload(res)
        if (cancelled) return

        if (res.status === 200) {
          setFeedback({ success: data?.status?.result?.message ?? "Rewarded ✅" })
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

        setFeedback({ error: data?.error || text?.trim() || `Mining failed (status ${res.status}).` })
        setPolling(null)
        setIsLoading(false)
      } catch (error) {
        if (cancelled) return
        setFeedback((prev) => prev.error ? prev : { error: "Status check failed. Retrying..." })
      }
    }

    const i = setInterval(tick, POLL_INTERVAL_MS)
    tick()

    return () => {
      cancelled = true
      clearInterval(i)
    }
  }, [polling, onMiningSuccess, readResponsePayload, router, statusCopy])

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
