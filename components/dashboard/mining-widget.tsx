"use client"

import { useRef, useState, useTransition } from "react"
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

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [loading, startTransition] = useTransition()
  const [polling, setPolling] = useState(false)

  // ✅ prevent multiple parallel polls
  const pollingRef = useRef(false)

  async function pollStatus(statusUrl: string) {
    if (pollingRef.current) return
    pollingRef.current = true
    setPolling(true)

    try {
      const started = Date.now()
      let interval = 700

      while (Date.now() - started < 30_000) {
        const res = await fetch(statusUrl, {
          cache: "no-store",
          credentials: "include",
        })

        const data: any = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data?.error || "Unable to fetch mining status")
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

        await sleep(interval)
        interval = Math.min(2000, Math.floor(interval * 1.25))
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
        setPolling(true)

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
