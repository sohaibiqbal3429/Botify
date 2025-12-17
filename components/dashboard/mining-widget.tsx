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

type MiningStatus = {
  status?: "queued" | "processing" | "completed" | "failed"
  queueDepth?: number
  userId?: string
  error?: { message?: string; retryable?: boolean; retryAfterMs?: number }
  result?: { message?: string }
}

type MiningPostResponse = {
  status?: MiningStatus
  statusUrl?: string
  error?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [loading, startTransition] = useTransition()
  const [polling, setPolling] = useState(false)
  const pollAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => pollAbortRef.current?.abort()
  }, [])

  const makeIdempotencyKey = () =>
    (globalThis.crypto as any)?.randomUUID?.() || `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`

  const pollStatus = async (statusUrl: string) => {
    setPolling(true)
    try {
      const started = Date.now()
      let wait = 900

      while (Date.now() - started < 30_000) {
        pollAbortRef.current?.abort()
        const controller = new AbortController()
        pollAbortRef.current = controller

        const res = await fetch(statusUrl, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        })

        const data: any = await res.json().catch(() => ({}))
        const s: MiningStatus | undefined = data?.status
        const state = s?.status

        if (!res.ok) {
          // handle retryable (503 with Retry-After/X-Backoff-Hint)
          if (res.status === 503) {
            const retryAfter = Number(res.headers.get("Retry-After") || "1")
            const backoffHint = Number(res.headers.get("X-Backoff-Hint") || String(retryAfter))
            await sleep(Math.max(1, backoffHint) * 1000)
            continue
          }
          throw new Error(data?.error || s?.error?.message || "Unable to fetch mining status")
        }

        if (state === "completed") {
          toast({ title: "✅ Mining rewarded", description: s?.result?.message || "Reward added successfully." })
          await onMiningSuccess?.()
          return
        }

        if (state === "failed") {
          const retryable = s?.error?.retryable
          toast({
            variant: retryable ? "default" : "destructive",
            title: retryable ? "Mining delayed" : "Mining failed",
            description: s?.error?.message || "Please try again",
          })
          if (retryable) {
            await sleep(Math.min(10_000, Math.max(800, s?.error?.retryAfterMs ?? 1500)))
            continue
          }
          return
        }

        // queued / processing
        await sleep(wait)
        wait = Math.min(2500, Math.floor(wait * 1.25))
      }

      throw new Error("Mining is taking too long. Please try again.")
    } finally {
      setPolling(false)
    }
  }

  function handleMining() {
    if (mining.requiresDeposit) {
      toast({ variant: "destructive", title: "Deposit required", description: "Please deposit funds before mining." })
      return
    }

    if (mining.canMine === false) {
      const nextTime = mining.nextEligibleAt ? new Date(mining.nextEligibleAt).toLocaleString() : null
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
      const key = makeIdempotencyKey()

      try {
        const res = await fetch("/api/mining/click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          credentials: "include",
        })

        const data: MiningPostResponse = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data?.error || "Unable to start mining")
        }

        const statusUrl =
          data?.statusUrl || `/api/mining/click?key=${encodeURIComponent(key)}` // fallback

        // If completed immediately, no need to poll
        if (data?.status?.status === "completed") {
          toast({ title: "✅ Mining rewarded", description: data?.status?.result?.message || "Reward added." })
          await onMiningSuccess?.()
          return
        }

        await pollStatus(statusUrl)
      } catch (err: any) {
        toast({ variant: "destructive", title: "Mining error", description: err?.message || "Something went wrong" })
      }
    })
  }

  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="text-lg font-semibold">Miningg</div>
      <Button onClick={handleMining} disabled={loading || polling} className="w-full">
        {loading || polling ? "Mining..." : "Start Miningg"}
      </Button>
    </div>
  )
}
