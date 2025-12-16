// "use client"

// import Link from "next/link"
// import { useRouter } from "next/navigation"
// import { useCallback, useEffect, useRef, useState } from "react"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Badge } from "@/components/ui/badge"
// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Loader2, Zap, Clock, AlertCircle, Coins } from "lucide-react"

// interface MiningWidgetProps {
//   mining: {
//     canMine: boolean
//     nextEligibleAt: string
//     earnedInCycle: number
//     requiresDeposit?: boolean
//     minDeposit?: number
//   }
//   onMiningSuccess?: () => void
// }

// export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
//   const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({})
//   const router = useRouter()

//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const lastClickRef = useRef<number>(0)
//   const CLICK_DEBOUNCE_MS = 400

//   const formatTimeUntilNext = () => {
//     if (!mining.nextEligibleAt) return "Ready to mine!"
//     const now = new Date()
//     const nextTime = new Date(mining.nextEligibleAt)
//     const diff = nextTime.getTime() - now.getTime()
//     if (diff <= 0) return "Ready to mine!"

//     const hours = Math.floor(diff / (1000 * 60 * 60))
//     const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
//     const seconds = Math.floor((diff % (1000 * 60)) / 1000)

//     return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
//       .toString()
//       .padStart(2, "0")}`
//   }

//   const [nextWindowDisplay, setNextWindowDisplay] = useState(() => formatTimeUntilNext())

//   useEffect(() => {
//     const interval = setInterval(() => setNextWindowDisplay(formatTimeUntilNext()), 1000)
//     return () => clearInterval(interval)
//   }, [mining.nextEligibleAt])

//   const handleMining = useCallback(async () => {
//     const now = Date.now()
//     if (now - lastClickRef.current < CLICK_DEBOUNCE_MS) {
//       setFeedback({ error: "Easy there! Please wait a moment before trying again." })
//       return
//     }
//     lastClickRef.current = now

//     if (isSubmitting) {
//       setFeedback({ error: "We are already processing a mining request." })
//       return
//     }

//     try {
//       setFeedback({})
//       setIsSubmitting(true)

//       const idempotencyKey = crypto.randomUUID()

//       const response = await fetch("/api/mining/click", {
//         method: "POST",
//         headers: {
//           "Idempotency-Key": idempotencyKey,
//         },
//         cache: "no-store",
//       })

//       const data = await response.json().catch(() => ({}))

//       // ✅ success (instant reward)
//       if (response.ok) {
//         const result = data?.status?.result
//         const profit = typeof result?.profit === "number" ? result.profit : undefined

//         setFeedback({
//           success:
//             result?.message ??
//             (profit !== undefined ? `Mining successful! Earned $${profit.toFixed(2)}` : "Mining successful!"),
//         })

//         router.refresh()
//         onMiningSuccess?.()
//         return
//       }

//       // ❌ show backend error message
//       setFeedback({ error: data?.error ?? "Unable to start mining. Please try again." })
//     } catch (error) {
//       console.error("Mining request failed", error)
//       setFeedback({ error: "Unable to reach the mining service. Please try again." })
//     } finally {
//       setIsSubmitting(false)
//     }
//   }, [isSubmitting, router, onMiningSuccess])

//   // UI status badge (visual only)
//   const statusBadge = mining.canMine
//     ? { label: "Engine ready", color: "bg-emerald-500/20 text-emerald-200" }
//     : mining.requiresDeposit
//       ? { label: "Funding needed", color: "bg-amber-500/20 text-amber-200" }
//       : { label: "Cooling down", color: "bg-sky-500/20 text-sky-200" }

//   return (
//     <Card className="col-span-full lg:col-span-2 overflow-hidden border border-emerald-500/25 bg-slate-950/80 shadow-xl shadow-emerald-500/15">
//       <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" />
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between text-slate-100">
//           <div className="flex items-center gap-3">
//             <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 shadow-inner shadow-emerald-500/20">
//               <Coins className="h-5 w-5" />
//             </div>
//             <div>
//               <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200">Core hashing engine</p>
//               <span className="text-lg font-semibold">Pulse reactor control</span>
//             </div>
//           </div>
//           <Badge className={`px-3 py-1 text-xs font-semibold ${statusBadge.color}`}>{statusBadge.label}</Badge>
//         </CardTitle>
//       </CardHeader>

//       <CardContent className="space-y-5">
//         {feedback.error && (
//           <Alert variant="destructive" className="border-red-500/40 bg-red-500/10 text-red-100">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>{feedback.error}</AlertDescription>
//           </Alert>
//         )}

//         {feedback.success && (
//           <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-50">
//             <Zap className="h-4 w-4" />
//             <AlertDescription>{feedback.success}</AlertDescription>
//           </Alert>
//         )}

//         <div className="grid gap-4 lg:grid-cols-3">
//           <div className="lg:col-span-2 space-y-4 rounded-xl border border-slate-800/80 bg-slate-900/70 p-4">
//             <div className="flex flex-wrap items-center gap-3">
//               <Badge variant="outline" className="border-emerald-500/60 text-emerald-100">
//                 <Clock className="mr-2 h-4 w-4" /> Next boost window
//               </Badge>
//               <span className="rounded-md bg-slate-800 px-3 py-1 font-mono text-sm text-cyan-200">
//                 {nextWindowDisplay}
//               </span>
//               <span className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-300">
//                 Click to attempt (backend enforces rules)
//               </span>
//             </div>

//             <div className="grid gap-3 sm:grid-cols-3">
//               <div className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-900/80 p-3">
//                 <p className="text-xs uppercase tracking-wide text-slate-400">Cycle access</p>
//                 <p className="text-lg font-semibold text-white">{mining.canMine ? "Available" : "Restricted"}</p>
//                 <p className="text-xs text-slate-500">Final decision is server-side</p>
//               </div>
//               <div className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-900/80 p-3">
//                 <p className="text-xs uppercase tracking-wide text-slate-400">Queue status</p>
//                 <p className="text-lg font-semibold text-white">{isSubmitting ? "Processing" : "Idle"}</p>
//                 <p className="text-xs text-slate-500">Instant reward path</p>
//               </div>
//               <div className="space-y-2 rounded-lg border border-slate-800/70 bg-slate-900/80 p-3">
//                 <p className="text-xs uppercase tracking-wide text-slate-400">Safety nets</p>
//                 <p className="text-lg font-semibold text-white">Cooldown + KYC</p>
//                 <p className="text-xs text-slate-500">Enforced by backend</p>
//               </div>
//             </div>

//             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//               <div className="space-y-1">
//                 <p className="text-sm font-semibold text-white">Boost controller</p>
//                 <p className="text-xs text-slate-400">Click attempts a single earning cycle.</p>
//               </div>

//               <Button
//                 onClick={() => void handleMining()}
//                 disabled={isSubmitting}
//                 size="lg"
//                 className="h-11 min-w-[220px] bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 hover:brightness-110"
//               >
//                 {isSubmitting ? (
//                   <>
//                     <Loader2 className="mr-2 h-5 w-5 animate-spin" />
//                     Engine running...
//                   </>
//                 ) : (
//                   <>
//                     <Zap className="mr-2 h-5 w-5" />
//                     Start Boost Cycle
//                   </>
//                 )}
//               </Button>
//             </div>

//             {mining.requiresDeposit && (
//               <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-50">
//                 <AlertCircle className="h-4 w-4" />
//                 <span>
//                   Funding required. Minimum top-up {mining.minDeposit?.toFixed(0) ?? 30} USDT to activate the engine.
//                 </span>
//                 <Button asChild variant="secondary" className="bg-amber-400 text-slate-900 hover:bg-amber-300">
//                   <Link href="/wallet/deposit">Add funds</Link>
//                 </Button>
//               </div>
//             )}
//           </div>

//           <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-900/70 p-4">
//             <div className="flex items-center justify-between">
//               <p className="text-sm text-slate-300">Cycle yield</p>
//               <Badge variant="outline" className="border-emerald-500/60 text-emerald-200">
//                 Live
//               </Badge>
//             </div>
//             <p className="text-3xl font-semibold text-white">${mining.earnedInCycle.toFixed(2)}</p>
//             <p className="text-xs text-slate-500">Earnings captured in the latest completed run.</p>

//             <div className="rounded-lg border border-slate-800/70 bg-slate-950/70 p-3">
//               <p className="text-sm text-slate-300">Next unlock</p>
//               <p className="font-mono text-lg text-cyan-200">{nextWindowDisplay}</p>
//             </div>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )
// }




"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Zap, Clock, AlertCircle, Coins } from "lucide-react"
import { motion } from "framer-motion"

interface MiningWidgetProps {
  mining: {
    canMine: boolean
    nextEligibleAt: string
    earnedInCycle: number
    requiresDeposit?: boolean
    minDeposit?: number
  }
  onMiningSuccess?: () => void
}

export function MiningWidget({ mining, onMiningSuccess }: MiningWidgetProps) {
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({})
  const router = useRouter()
  const [canMine, setCanMine] = useState(mining.canMine)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [polling, setPolling] = useState<{
    key: string
    url: string
  } | null>(null)
  const lastClickRef = useRef<number>(0)
  const CLICK_DEBOUNCE_MS = 400

  const formatTimeUntilNext = () => {
    if (!mining.nextEligibleAt) return "Ready to mine!"
    const now = new Date()
    const nextTime = new Date(mining.nextEligibleAt)
    const diff = nextTime.getTime() - now.getTime()

    if (diff <= 0) return "Ready to mine!"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`
  }

  const [nextWindowDisplay, setNextWindowDisplay] = useState(() => formatTimeUntilNext())

  useEffect(() => {
    setCanMine(mining.canMine)
  }, [mining.canMine])

  const handleMining = useCallback(async () => {
    const now = Date.now()
    if (now - lastClickRef.current < CLICK_DEBOUNCE_MS) {
      setFeedback({ error: "Easy there! Please wait a moment before trying again." })
      return
    }

    lastClickRef.current = now

    if (!canMine) {
      setFeedback({ error: "Mining is not available right now." })
      return
    }

    if (isSubmitting || polling) {
      setFeedback({ error: "We are already processing a mining request." })
      return
    }

    try {
      setFeedback({})
      setIsSubmitting(true)
      const idempotencyKey = crypto.randomUUID()
      const response = await fetch("/api/mining/click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
      })

      const data = await response.json().catch(() => ({}))

      if (response.status === 200) {
        const result = data?.status?.result
        const profit = typeof result?.profit === "number" ? result.profit : undefined
        setFeedback({
          success:
            result?.message ??
            (profit !== undefined ? `Mining successful! Earned $${profit.toFixed(2)}` : "Mining successful!"),
        })
        setCanMine(false)
        setPolling(null)
        router.refresh()
        onMiningSuccess?.()
        return
      }

      if (response.status === 202) {
        setFeedback({ success: "Mining request queued. We'll update you shortly." })
        setPolling({ key: idempotencyKey, url: data?.statusUrl })
        return
      }

      if (response.status === 429 || response.status === 503) {
        const retry = response.headers.get("Retry-After")
        const backoff = response.headers.get("X-Backoff-Hint")
        const retryMessage = retry ? ` Try again in ${retry} seconds.` : ""
        const backoffMessage = backoff ? ` Recommended backoff: ${backoff}s.` : ""
        setFeedback({
          error: `${data?.error ?? "System temporarily busy."}${retryMessage}${backoffMessage}`,
        })
        return
      }

      setFeedback({ error: data?.error ?? "Unable to start mining. Please try again." })
    } catch (error) {
      console.error("Mining request failed", error)
      setFeedback({ error: "Unable to reach the mining service. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }, [canMine, isSubmitting, polling, router])

  useEffect(() => {
    const updateCountdown = () => {
      const display = formatTimeUntilNext()
      setNextWindowDisplay(display)
      return display
    }

    const initialDisplay = updateCountdown()

    if (initialDisplay === "Ready to mine!" || canMine) {
      return
    }

    const interval = setInterval(() => {
      const currentDisplay = updateCountdown()
      if (currentDisplay === "Ready to mine!") {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [canMine, mining.nextEligibleAt])

  useEffect(() => {
    if (!polling?.url) {
      return
    }

    let cancelled = false

    const poll = async () => {
      try {
        const response = await fetch(polling.url, { cache: "no-store" })
        const data = await response.json().catch(() => ({}))
        if (cancelled) {
          return
        }

        if (response.status === 200) {
          const result = data?.status?.result
          const profit = typeof result?.profit === "number" ? result.profit : undefined
          setFeedback({
            success:
              result?.message ??
              (profit !== undefined ? `Mining successful! Earned $${profit.toFixed(2)}` : "Mining successful!"),
          })
          setCanMine(false)
          setPolling(null)
          router.refresh()
          onMiningSuccess?.()
          return
        }

        if (response.status === 202) {
          const queueDepth = response.headers.get("X-Queue-Depth")
          const status = data?.status?.status
          const message =
            status === "processing"
              ? "Mining request is processing..."
              : queueDepth
                ? `Mining queued. Position ~${queueDepth}.`
                : "Mining request queued..."
          setFeedback({ success: message })
          return
        }

        if (response.status === 429 || response.status === 503) {
          const retry = response.headers.get("Retry-After")
          const backoff = response.headers.get("X-Backoff-Hint")
          const retryMessage = retry ? ` Try again in ${retry} seconds.` : ""
          const backoffMessage = backoff ? ` Recommended backoff: ${backoff}s.` : ""
          setFeedback({
            error: `${data?.status?.error?.message ?? "System busy."}${retryMessage}${backoffMessage}`,
          })
        } else {
          setFeedback({ error: data?.status?.error?.message ?? "Mining request failed." })
        }
        setPolling(null)
      } catch (error) {
        if (cancelled) {
          return
        }
        console.error("Mining status poll failed", error)
        setFeedback({ error: "Lost connection while waiting for mining response." })
        setPolling(null)
      }
    }

    const interval = setInterval(poll, 1500)
    void poll()

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [polling, router])

  const isMiningBusy = isSubmitting || Boolean(polling)

  return (
    <Card className="dashboard-card col-span-full lg:col-span-2 crypto-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
              <Coins className="w-6 h-6 text-primary-foreground" />
            </div>
            {canMine && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <div className="crypto-gradient-text text-xl font-bold">Mint-Coin Mining</div>
            <div className="text-sm text-muted-foreground dark:text-secondary-dark">Decentralized Mining Protocol</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {feedback.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{feedback.error}</AlertDescription>
          </Alert>
        )}

        {feedback.success && (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <Zap className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-success-dark">{feedback.success}</AlertDescription>
          </Alert>
        )}

        <div className="text-center space-y-6">
          <motion.div
            className="relative mx-auto w-40 h-40 flex items-center justify-center"
            whileHover={{ scale: canMine ? 1.05 : 1 }}
            whileTap={{ scale: canMine ? 0.95 : 1 }}
          >
            <div
              className={`w-full h-full rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl relative overflow-hidden ${
                canMine && !isMiningBusy
                  ? "bg-gradient-to-br from-primary to-accent cursor-pointer crypto-glow"
                  : "bg-gradient-to-br from-gray-400 to-gray-600 cursor-not-allowed"
              }`}
              onClick={canMine && !isMiningBusy ? handleMining : undefined}
            >
              <Coins className="w-16 h-16" />
              {canMine && !isMiningBusy && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent opacity-30"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </>
              )}
            </div>
          </motion.div>

          <div className="space-y-3">
            {canMine ? (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-success-dark px-4 py-2"
              >
                <Zap className="w-4 h-4 mr-2" />
                Mining Available
              </Badge>
            ) : mining.requiresDeposit ? (
              <Badge
                variant="secondary"
                className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-error-dark px-4 py-2"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Deposit Required
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-warn-dark px-4 py-2"
              >
                <Clock className="w-4 h-4 mr-2" />
                Cooldown Period
              </Badge>
            )}
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm font-medium text-muted-foreground dark:text-secondary-dark">Next Mining Window</p>
              <p className="text-lg font-mono font-bold text-foreground dark:text-primary-dark">{nextWindowDisplay}</p>
            </div>
          </div>

          <Button
            onClick={() => void handleMining()}
            disabled={!canMine || isMiningBusy}
            size="lg"
            className="w-full max-w-sm h-12 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            {isMiningBusy ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Mining in Progress...
              </>
            ) : (
              <>
                <Zap className="mr-3 h-5 w-5" />
                {canMine ? "Start Mining" : "Mining Unavailable"}
              </>
            )}
          </Button>

          {mining.requiresDeposit && (
            <Button
              asChild
              variant="outline"
              className="w-full max-w-sm h-11 border-dashed border-slate-300 text-sm font-semibold"
            >
              <Link href="/wallet/deposit">
                Make a deposit (min ${mining.minDeposit?.toFixed(0) ?? 30} USDT)
              </Link>
            </Button>
          )}

          {mining.earnedInCycle > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-muted-foreground dark:text-muted-dark mb-1">Last Mining Cycle</p>
              <p className="text-2xl font-bold crypto-gradient-text">+${mining.earnedInCycle.toFixed(2)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
