"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

type MiningWidgetProps = {
  mining: {
    requiresDeposit: boolean
    canMine?: boolean
    timeLeft?: number
    nextEligibleAt?: string | null
  }
  onMiningSuccess?: () => void | Promise<void>
}

type MiningApiResponse = {
  status?: { status?: string; error?: { message?: string } }
  statusUrl?: string
  error?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const POLL_INTERVAL_MS = 1000
const MAX_POLL_ATTEMPTS = 12
const MAX_POLL_INTERVAL_MS = 10_000
const PENDING_STORAGE_KEY = "botify:mining:pending-status"
const MAX_PENDING_AGE_MS = 1000 * 60 * 60 * 12 // half a day to avoid stale replays

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [loading, startTransition] = useTransition()
  const [polling, setPolling] = useState(false)
  const [pendingStatusUrl, setPendingStatusUrl] = useState<string | null>(null)

  // ✅ prevent multiple parallel polls
  const pollingRef = useRef(false)
  const pollAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(PENDING_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as { statusUrl: string; savedAt: number }
      if (!parsed?.statusUrl || !parsed?.savedAt) {
        window.localStorage.removeItem(PENDING_STORAGE_KEY)
        return
      }

      if (Date.now() - parsed.savedAt > MAX_PENDING_AGE_MS) {
        window.localStorage.removeItem(PENDING_STORAGE_KEY)
        return
      }

      setPendingStatusUrl(parsed.statusUrl)
      pollStatus(parsed.statusUrl)
    } catch (err) {
      console.warn("Failed to restore pending mining status", err)
      window.localStorage.removeItem(PENDING_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    return () => {
      pollingRef.current = false
      pollAbortRef.current?.abort()
    }
  }, [])

  function storePendingStatus(statusUrl: string) {
    try {
      if (typeof window === "undefined") return
      window.localStorage.setItem(
        PENDING_STORAGE_KEY,
        JSON.stringify({ statusUrl, savedAt: Date.now() }),
      )
      setPendingStatusUrl(statusUrl)
    } catch (err) {
      console.warn("Unable to persist pending mining status", err)
    }
  }

  function clearPendingStatus() {
    try {
      if (typeof window === "undefined") return
      window.localStorage.removeItem(PENDING_STORAGE_KEY)
      setPendingStatusUrl(null)
    } catch (err) {
      console.warn("Unable to clear pending mining status", err)
    }
  }

  async function pollStatus(statusUrl: string) {
    if (pollingRef.current) return
    pollingRef.current = true
    setPolling(true)

    try {
      let attempt = 0
      let queueDepthNotified = false
      let nextDelay = POLL_INTERVAL_MS

      while (attempt < MAX_POLL_ATTEMPTS) {
        attempt += 1

        if (document.visibilityState === "hidden") {
          await sleep(POLL_INTERVAL_MS)
          continue
        }

        pollAbortRef.current?.abort()
        const controller = new AbortController()
        pollAbortRef.current = controller

        const res = await fetch(statusUrl, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        })

        const data: any = await res.json().catch(() => ({}))
        const retryAfterHeader = res.headers.get("Retry-After")
        const retryAfterSeconds = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : null
        const backoffHintHeader = res.headers.get("X-Backoff-Hint")
        const backoffHintSeconds = backoffHintHeader ? Number.parseFloat(backoffHintHeader) : null
        const queueDepthHeader = res.headers.get("X-Queue-Depth")
        const queueDepth = queueDepthHeader ? Number.parseInt(queueDepthHeader) : null

        if (queueDepth && queueDepth > 2000 && !queueDepthNotified) {
          toast({
            title: "Mining queue is busy",
            description: "We queued your reward safely. It may take a moment to finalize.",
          })
          queueDepthNotified = true
        }

        const retryDelay = Number.isFinite(retryAfterSeconds)
          ? Math.max(POLL_INTERVAL_MS, retryAfterSeconds * 1000)
          : POLL_INTERVAL_MS

        const backoffHintDelay = Number.isFinite(backoffHintSeconds)
          ? Math.max(POLL_INTERVAL_MS, backoffHintSeconds * 1000)
          : POLL_INTERVAL_MS

        if (!res.ok) {
          throw new Error(data?.error || data?.status?.error?.message || "Unable to fetch mining status")
        }

        const state = data?.status?.status

        if (state === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added successfully.",
          })
          clearPendingStatus()
          await onMiningSuccess?.()
          return
        }

        if (state === "failed") {
          toast({
            variant: "destructive",
            title: "Mining failed",
            description: data?.status?.error?.message || "Please try again",
          })
          clearPendingStatus()
          return
        }

        if (state !== "queued" && state !== "processing") {
          throw new Error("Unexpected mining status. Please try again.")
        }

        nextDelay = Math.min(
          Math.max(retryDelay, backoffHintDelay, nextDelay * 1.4),
          MAX_POLL_INTERVAL_MS,
        )

        if (queueDepth && queueDepth > 0) {
          nextDelay = Math.min(MAX_POLL_INTERVAL_MS, Math.max(nextDelay, Math.min(queueDepth * 2, 8000)))
        }

        await sleep(nextDelay)
      }

      toast({
        title: "Mining is finalizing",
        description: "We will keep your request queued. Check back in a few moments.",
      })
      storePendingStatus(statusUrl)
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Mining error",
        description: err?.message || "Something went wrong",
      })
      storePendingStatus(statusUrl)
    } finally {
      pollingRef.current = false
      pollAbortRef.current?.abort()
      setPolling(false)
    }
  }

  function handleMining() {
    if (mining.requiresDeposit) {
      toast({
        variant: "destructive",
        title: "Deposit required",
        description: "Please deposit funds before mining.",
      })
      return
    }

    if (mining.canMine === false) {
      const nextTime = mining.nextEligibleAt
        ? new Date(mining.nextEligibleAt).toLocaleString()
        : null

      toast({
        variant: "destructive",
        title: "Mining cooldown active",
        description:
          nextTime ||
          (mining.timeLeft
            ? `Try again in ${Math.max(1, Math.ceil(mining.timeLeft / 60))} minutes.`
            : "Please try again later."),
      })
      return
    }

    startTransition(async () => {
      try {
        // ✅ Always send idempotency key so server can dedupe
        const idempotencyKey =
          (globalThis.crypto as any)?.randomUUID?.() ||
          `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`

        const res = await fetch("/api/mining/click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          credentials: "include",
        })

        const data: MiningApiResponse = await res.json().catch(() => ({}))

        const statusUrl = data?.statusUrl

        // ✅ Direct completed
        if (res.status === 200 && data?.status?.status === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added.",
          })
          clearPendingStatus()
          await onMiningSuccess?.()
          setPolling(false)
          return
        }

        // ✅ Queued -> poll statusUrl
        if (res.status === 202 && statusUrl) {
          storePendingStatus(statusUrl)
          await pollStatus(statusUrl)
          return
        }

        // ✅ real error message
        throw new Error(data?.error || "Unable to start mining")
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Mining error",
          description: err?.message || "Something went wrong",
        })
      } finally {
        setPolling(false)
      }
    })
  }

  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="text-lg font-semibold">Mining</div>

      <Button onClick={handleMining} disabled={loading || polling} className="w-full">
        {loading || polling ? "Mining..." : "Start Mining"}
      </Button>
    </div>
  )
}
