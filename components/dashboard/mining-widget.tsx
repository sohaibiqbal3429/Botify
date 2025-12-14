"use client"

import { useState, useTransition } from "react"
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

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [loading, startTransition] = useTransition()
  const [polling, setPolling] = useState(false)

  async function pollStatus(statusUrl: string) {
    const start = Date.now()

    try {
      while (Date.now() - start < 15_000) {
        const res = await fetch(statusUrl, { cache: "no-store", credentials: "include" })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          const message = body?.error || "Unable to fetch mining status"
          throw new Error(message)
        }

        const data = await res.json()

        if (data.status?.status === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added successfully.",
          })
          await onMiningSuccess?.()
          setPolling(false)
          return
        }

        if (data.status?.status === "failed") {
          toast({
            variant: "destructive",
            title: "Mining failed",
            description: data.status?.error?.message || "Please try again",
          })
          await onMiningSuccess?.()
          setPolling(false)
          return
        }

        await new Promise((r) => setTimeout(r, 1000))
      }

      throw new Error("Mining is taking too long. Please refresh.")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Mining status error",
        description: error?.message || "Unable to get mining progress.",
      })
    } finally {
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
          (mining.timeLeft ? `Try again in ${Math.max(1, Math.ceil(mining.timeLeft / 60))} minutes.` : "Please try again later."),
      })
      return
    }

    startTransition(async () => {
      try {
        setPolling(true)

        const res = await fetch("/api/mining/click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        })

        const data = await res.json()

        // ✅ Direct success
        if (res.status === 200 && data?.status?.status === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added.",
          })
          await onMiningSuccess?.()
          setPolling(false)
          return
        }

        // ✅ Queued → poll
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
          description: err.message || "Something went wrong",
        })
      }
    })
  }

  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="text-lg font-semibold">Mining</div>

      <Button
        onClick={handleMining}
        disabled={loading || polling}
        className="w-full"
      >
        {loading || polling ? "Mining..." : "Start Mining"}
      </Button>
    </div>
  )
}
