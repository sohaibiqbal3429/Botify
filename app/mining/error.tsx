"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

interface MiningErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function MiningError({ error, reset }: MiningErrorProps) {
  useEffect(() => {
    console.error("Mining page error", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <span className="text-2xl">⛏️</span>
        </div>
        <h1 className="text-xl font-semibold">Mining unavailable</h1>
        <p className="text-sm text-muted-foreground">
          We hit a snag while loading the mining controls. Please retry or head back to your dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => reset()}>
            Try again
          </Button>
          <Button onClick={() => (typeof window !== "undefined" ? window.location.assign("/dashboard") : reset())}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
