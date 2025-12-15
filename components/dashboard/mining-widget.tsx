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

function makeIdemKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [loading, startTransition] = useTransition()
  const [polling, setPolling] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function pollStatus(statusUrl: string) {
    const start = Date.now()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      while (Date.now() - start < 25_000) {
        const res = await fetch(statusUrl, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          throw new Error(data?.error || "Unable to fetch mining status")
        }

        const s = data?.status?.status

        if (s === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added successfully.",
          })
          await onMiningSuccess?.()
          return
        }

        if (s === "failed") {
          toast({
            variant: "destructive",
            title: "Mining failed",
            description: data?.status?.error?.message || "Please try again.",
          })
          return
        }

        // ✅ slower polling = less chance of rate-limit
        await new Promise((r) => setTimeout(r, 3000))
      }

      throw new Error("Mining is taking too long. Please refresh.")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Mining error",
        description: error?.message || "Unable to get mining progress.",
      })
    } finally {
      abortRef.current = null
      setPolling(false)
    }
  }

  function handleMining() {
    if (polling || loading) return

    if (mining.requiresDeposit) {
      toast({
        variant: "destructive",
        title: "Deposit required",
        description: "Please deposit funds before mining.",
      })
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
      setPolling(true)

      try {
        const idempotencyKey = makeIdemKey()

        const res = await fetch("/api/mining/click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          credentials: "include",
        })

        const data = await res.json().catch(() => null)

        // ✅ direct completed
        if (res.status === 200 && data?.status?.status === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added.",
          })
          await onMiningSuccess?.()
          setPolling(false)
          return
        }

        // ✅ queued: poll
        if (res.status === 202 && data?.statusUrl) {
          await pollStatus(data.statusUrl)
          return
        }

        throw new Error(data?.error || "Unable to start mining")
      } catch (err: any) {
        setPolling(false)
        toast({
          variant: "destructive",
          title: "Mining error",
          description: err?.message || "Something went wrong",
        })
      }
    })
  }

  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="text-lg font-semibold">Mining</div>

      <Button onClick={handleMining} disabled={loading || polling} className="w-full">
        {loading || polling ? "Mining..." : "Start Mining"}
      </Button>

      {polling ? (
        <p className="text-xs text-muted-foreground">
          Processing your mining request… please wait.
        </p>
      ) : null}
    </div>
  )
}
