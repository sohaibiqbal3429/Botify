"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
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

function makeIdempotencyKey() {
  // works in modern browsers
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [loading, startTransition] = useTransition()
  const [polling, setPolling] = useState(false)

  const inFlightRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const idempotencyRef = useRef<string | null>(null)

  // prevent infinite loops on re-renders
  const disabled = loading || polling

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      inFlightRef.current = false
    }
  }, [])

  async function pollStatus(statusUrl: string, idemKey: string) {
    const startedAt = Date.now()
    const TIMEOUT_MS = 20_000
    const POLL_EVERY_MS = 1000

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      while (Date.now() - startedAt < TIMEOUT_MS) {
        const res = await fetch(statusUrl, {
          cache: "no-store",
          credentials: "include",
          signal: abortRef.current.signal,
          headers: {
            // keep same key on status too (safe)
            "Idempotency-Key": idemKey,
          },
        })

        // Handle temporary backoff
        if (res.status === 429 || res.status === 503) {
          const retryAfter = Number(res.headers.get("Retry-After") || "1")
          await sleep(Math.min(5000, Math.max(1000, retryAfter * 1000)))
          continue
        }

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          throw new Error(data?.error || "Unable to fetch mining status")
        }

        const st = data?.status?.status

        if (st === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added successfully.",
          })
          await onMiningSuccess?.()
          return
        }

        if (st === "failed") {
          toast({
            variant: "destructive",
            title: "Mining failed",
            description: data?.status?.error?.message || "Please try again",
          })
          return
        }

        // queued/processing -> wait
        await sleep(POLL_EVERY_MS)
      }

      throw new Error("Mining is taking too long. Please try again.")
    } finally {
      setPolling(false)
      inFlightRef.current = false
    }
  }

  function handleMining() {
    if (disabled || inFlightRef.current) return

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
      inFlightRef.current = true
      setPolling(true)

      // ✅ Generate & persist one key per click
      const idemKey = makeIdempotencyKey()
      idempotencyRef.current = idemKey

      try {
        const res = await fetch("/api/mining/click", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idemKey, // ✅ critical
          },
        })

        // If backend returns a different key, prefer it
        const returnedKey = res.headers.get("Idempotency-Key")?.trim()
        const finalKey = returnedKey || idemKey

        const data = await res.json().catch(() => null)

        // ✅ Direct success
        if (res.status === 200 && data?.status?.status === "completed") {
          toast({
            title: "✅ Mining rewarded",
            description: "Your mining reward has been added.",
          })
          await onMiningSuccess?.()
          setPolling(false)
          inFlightRef.current = false
          return
        }

        // ✅ Queued: poll statusUrl
        if (res.status === 202) {
          const statusUrl =
            data?.statusUrl ||
            `/api/mining/click/status?key=${encodeURIComponent(finalKey)}`

          await pollStatus(statusUrl, finalKey)
          return
        }

        // Show exact server error (cooldown/roi cap/etc)
        throw new Error(data?.error || "Unable to start mining")
      } catch (err: any) {
        setPolling(false)
        inFlightRef.current = false

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

      <Button onClick={handleMining} disabled={disabled} className="w-full">
        {disabled ? "Mining..." : "Start Mining"}
      </Button>
    </div>
  )
}
