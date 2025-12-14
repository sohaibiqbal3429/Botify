"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

type MiningWidgetProps = {
  mining: {
    requiresDeposit: boolean
  }
}

export function MiningWidget({ mining }: MiningWidgetProps) {
  const [loading, startTransition] = useTransition()
  const [polling, setPolling] = useState(false)

  async function pollStatus(statusUrl: string) {
    const start = Date.now()

    while (Date.now() - start < 15_000) {
      const res = await fetch(statusUrl, { cache: "no-store" })
      const data = await res.json()

      if (data.status?.status === "completed") {
        toast({
          title: "✅ Mining rewarded",
          description: "Your mining reward has been added successfully.",
        })
        setPolling(false)
        return
      }

      if (data.status?.status === "failed") {
        toast({
          variant: "destructive",
          title: "Mining failed",
          description: data.status?.error?.message || "Please try again",
        })
        setPolling(false)
        return
      }

      await new Promise((r) => setTimeout(r, 1000))
    }

    setPolling(false)
    toast({
      variant: "destructive",
      title: "Timeout",
      description: "Mining is taking too long. Please refresh.",
    })
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

    startTransition(async () => {
      try {
        setPolling(true)

        const res = await fetch("/api/mining/click", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        })

        const data = await res.json()

        // ✅ Direct success
        if (res.status === 200 && data?.status?.status === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added.",
          })
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
