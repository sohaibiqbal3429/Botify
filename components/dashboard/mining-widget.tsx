"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type FeedbackState = { success?: string; error?: string }

export interface MiningWidgetProps {
  mining: {
    canMine: boolean
    nextEligibleAt: string | null
    lastClickAt?: string | null
    earnedInCycle: number
    timeLeft?: number
    requiresDeposit?: boolean
    minDeposit?: number
    roiCapReached?: boolean
  }
  onMiningSuccess?: () => void
}

const POLL_INTERVAL_MS = 1500
const POLL_WARNING_MS = 30_000
const POLL_MAX_MS = 45_000
const CLICK_DEBOUNCE_MS = 600

function deriveCooldownMs(nextEligibleAt?: string | null, timeLeft?: number) {
  const fromTimeLeft = typeof timeLeft === "number" ? Math.max(0, timeLeft * 1000) : 0
  let fromNextEligible = 0

  if (nextEligibleAt) {
    const parsed = new Date(nextEligibleAt)
    const delta = parsed.getTime() - Date.now()
    fromNextEligible = Number.isFinite(delta) ? Math.max(0, delta) : 0
  }

  return Math.max(fromTimeLeft, fromNextEligible)
}

function makeIdempotencyKey() {
  // Prefer stable per-click UUID when available
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>({})
  const [canMine, setCanMine] = useState(
    mining.canMine ||
      (!mining.requiresDeposit && !mining.roiCapReached && (mining.timeLeft ?? 0) <= 0),
  )
  const [cooldownMs, setCooldownMs] = useState(() => deriveCooldownMs(mining.nextEligibleAt, mining.timeLeft))
  const [lastEarned, setLastEarned] = useState<number>(mining.earnedInCycle ?? 0)
  const [lastMinedAt, setLastMinedAt] = useState<string | null>(mining.lastClickAt ?? null)

  const [polling, setPolling] = useState<null | { url: string; idempotencyKey: string }>(null)
  const pollStartedAtRef = useRef(0)
  const lastClickRef = useRef(0)
  const pendingNextEligibleRef = useRef<string | null>(null)

  useEffect(() => {
    const derivedCooldown = deriveCooldownMs(mining.nextEligibleAt, mining.timeLeft)
    pendingNextEligibleRef.current = null
    setCooldownMs(derivedCooldown)
    setCanMine(
      mining.canMine ||
        (!mining.requiresDeposit && !mining.roiCapReached && derivedCooldown <= 0),
    )
    setLastEarned(mining.earnedInCycle ?? 0)
    setLastMinedAt(mining.lastClickAt ?? null)
  }, [
    mining.canMine,
    mining.earnedInCycle,
    mining.lastClickAt,
    mining.nextEligibleAt,
    mining.requiresDeposit,
    mining.roiCapReached,
    mining.timeLeft,
  ])

  const resetState = useCallback(() => {
    setFeedback({})
    setPolling(null)
    setIsSubmitting(false)
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

  const lastMinedCopy = useMemo(() => {
    if (!lastMinedAt) return "—"
    const parsed = new Date(lastMinedAt)
    if (Number.isNaN(parsed.getTime())) return "—"
    return parsed.toLocaleString()
  }, [lastMinedAt])

  const updateCooldownFromResponse = useCallback((statusResult: any) => {
    const nextEligibleAt =
      statusResult?.nextEligibleAt ?? statusResult?.result?.nextEligibleAt ?? statusResult?.status?.result?.nextEligibleAt
    const timeLeft =
      statusResult?.timeLeft ?? statusResult?.result?.timeLeft ?? statusResult?.status?.result?.timeLeft
    if (typeof nextEligibleAt === "string" && nextEligibleAt) {
      pendingNextEligibleRef.current = nextEligibleAt
      setCooldownMs(deriveCooldownMs(nextEligibleAt, timeLeft))
      setCanMine(false)
    } else if (typeof timeLeft === "number") {
      setCooldownMs(deriveCooldownMs(null, timeLeft))
      setCanMine(false)
    }
    const reward = statusResult?.profit ?? statusResult?.result?.profit ?? statusResult?.status?.result?.profit
    if (typeof reward === "number") {
      setLastEarned(reward)
    }
    const rewardedAt =
      statusResult?.updatedAt ?? statusResult?.result?.updatedAt ?? statusResult?.status?.updatedAt ?? statusResult?.status?.result?.updatedAt
    if (typeof rewardedAt === "string") {
      setLastMinedAt(rewardedAt)
    }
  }, [])

  const cooldownLabel = useMemo(() => {
    if (mining.requiresDeposit) {
      return `Deposit at least $${mining.minDeposit ?? 0} to start mining`
    }
    if (mining.roiCapReached) {
      return "ROI cap reached — mining paused"
    }
    if (canMine || cooldownMs <= 0) return "Ready to mine"

    const totalSeconds = Math.max(0, Math.ceil(cooldownMs / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const segments = [
      hours ? `${hours}h` : null,
      minutes ? `${minutes}m` : null,
      `${seconds}s`,
    ].filter(Boolean)

    return `Next window in ${segments.join(" ")}`
  }, [canMine, cooldownMs, mining.minDeposit, mining.requiresDeposit, mining.roiCapReached])

  const nextWindowLabel = useMemo(() => {
    if (polling) return "In progress"
    if (mining.requiresDeposit) return "Deposit required"
    if (mining.roiCapReached) return "Capped"
    if (cooldownMs > 0) return cooldownLabel.replace("Next window in ", "")
    return "Now"
  }, [cooldownLabel, cooldownMs, mining.requiresDeposit, mining.roiCapReached, polling])

  useEffect(() => {
    if (cooldownMs <= 0) return

    const tick = () => {
      setCooldownMs((prev) => {
        const next = Math.max(0, prev - 1000)
        if (
          next <= 0 &&
          !mining.requiresDeposit &&
          !mining.roiCapReached &&
          !polling &&
          !isSubmitting
        ) {
          pendingNextEligibleRef.current = null
          setCanMine(true)
        }
        return next
      })
    }

    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [cooldownMs, isSubmitting, mining.requiresDeposit, mining.roiCapReached, polling])

  const handleMining = useCallback(async () => {
    if (isSubmitting || polling) return
    const now = Date.now()
    if (now - lastClickRef.current < CLICK_DEBOUNCE_MS) return
    lastClickRef.current = now

    resetState()
    setIsSubmitting(true)

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
        updateCooldownFromResponse(data?.status)
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

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After")
        const suffix = retryAfter ? ` Please retry in ~${retryAfter}s.` : ""
        const fallbackError = data?.error || "Too many attempts. Slow down."
        setFeedback({ error: `${fallbackError}${suffix}` })
        return
      }

      const fallbackError =
        data?.error || text?.trim() || `Unable to start mining. (${res.status})`
      setFeedback({ error: fallbackError })
    } catch {
      setFeedback({ error: "Network error. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, onMiningSuccess, polling, readResponsePayload, resetState, router, updateCooldownFromResponse])

  useEffect(() => {
    if (!polling) return
    let cancelled = false

    const tick = async () => {
      try {
        const elapsed = Date.now() - pollStartedAtRef.current
        if (elapsed > POLL_MAX_MS) {
          setFeedback({ error: "Mining timed out. Please try again." })
          setPolling(null)
          setIsSubmitting(false)
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
          updateCooldownFromResponse(data?.status)
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

        if (res.status === 429) {
          const retryAfter = res.headers.get("Retry-After")
          const suffix = retryAfter ? ` Please retry in ~${retryAfter}s.` : ""
          setFeedback({ error: `${data?.error ?? "Too many attempts."}${suffix}` })
          setPolling(null)
          setIsSubmitting(false)
          return
        }

        if (res.status === 409 || res.status === 503) {
          const retryAfter = res.headers.get("Retry-After")
          const suffix = retryAfter ? ` Please retry in ~${retryAfter}s.` : ""
          setFeedback({ error: `${data?.error ?? "Mining temporarily unavailable."}${suffix}` })
          setPolling(null)
          setIsSubmitting(false)
          return
        }

        setFeedback({ error: data?.error || text?.trim() || `Mining failed (status ${res.status}).` })
        setPolling(null)
        setIsSubmitting(false)
      } catch (error) {
        if (cancelled) return
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setFeedback({ error: "You appear to be offline. Mining status paused." })
          setPolling(null)
          setIsSubmitting(false)
          return
        }
        setFeedback((prev) => (prev.error ? prev : { error: "Status check failed. Retrying..." }))
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
    <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Mining window</p>
          <p className="text-sm text-foreground">{cooldownLabel}</p>
        </div>
        {polling ? (
          <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-medium text-amber-900">
            Checking status{statusCopy}
          </span>
        ) : null}
      </div>

      {feedback.error ? <div className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{feedback.error}</div> : null}
      {feedback.success ? <div className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">{feedback.success}</div> : null}

      <button
        onClick={handleMining}
        disabled={!canMine || isSubmitting || !!polling || mining.requiresDeposit || mining.roiCapReached}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-black transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Starting..." : polling ? "Working..." : "Start Mining"}
      </button>

      <dl className="grid grid-cols-2 gap-4 text-sm text-slate-200 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Last reward</dt>
          <dd className="font-medium">${Number(lastEarned ?? 0).toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Last mined</dt>
          <dd className="font-medium">{lastMinedCopy}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Next window</dt>
          <dd className="font-medium">{nextWindowLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cycle yield</dt>
          <dd className="font-medium">${Number(mining.earnedInCycle ?? 0).toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  )
}
