"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // Surface the error to monitoring/console for debugging deployed issues
    console.error("Dashboard rendering error", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load your dashboard. Please try again or report this if it keeps happening.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => reset()}>
            Try again
          </Button>
          <Button onClick={() => (typeof window !== "undefined" ? window.location.assign("/") : reset())}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
