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
const POLL_TIMEOUT_MS = 20_000

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [loading, startTransition] = useTransition()
  const [polling, setPolling] = useState(false)

  // ✅ prevent multiple parallel polls
  const pollingRef = useRef(false)
  const pollAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      pollingRef.current = false
      pollAbortRef.current?.abort()
    }
  }, [])

  async function pollStatus(statusUrl: string) {
    if (pollingRef.current) return
    pollingRef.current = true
    setPolling(true)

    try {
      const started = Date.now()

      while (Date.now() - started < POLL_TIMEOUT_MS) {
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
        const retryDelay = Number.isFinite(retryAfterSeconds)
          ? Math.max(POLL_INTERVAL_MS, retryAfterSeconds * 1000)
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
          await onMiningSuccess?.()
          return
        }

        if (state === "failed") {
          toast({
            variant: "destructive",
            title: "Mining failed",
            description: data?.status?.error?.message || "Please try again",
          })
          return
        }

        if (state !== "queued" && state !== "processing") {
          throw new Error("Unexpected mining status. Please try again.")
        }

        await sleep(Math.min(retryDelay, POLL_TIMEOUT_MS))
      }

      throw new Error("Mining is taking too long. Please refresh.")
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Mining error",
        description: err?.message || "Something went wrong",
      })
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

        // ✅ Direct completed
        if (res.status === 200 && data?.status?.status === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added.",
          })
          await onMiningSuccess?.()
          setPolling(false)
          return
        }

        // ✅ Queued -> poll statusUrl
        if (res.status === 202 && data?.statusUrl) {
          await pollStatus(data.statusUrl)
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
