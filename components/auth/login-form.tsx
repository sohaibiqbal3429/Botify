"use client"

import { type FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, UserRoundPlus } from "lucide-react"

import { useTopLoader } from "@/components/top-loader"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LoginFormData {
  email: string
  password: string
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { startTask, stopTask } = useTopLoader()
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [blockedModalOpen, setBlockedModalOpen] = useState(false)

  const sanitizeMessage = (message: string | null | undefined) => {
    if (!message) return ""
    const text = message.trim()
    if (!text) return ""
    // Strip any HTML so raw server responses are not rendered in the UI
    const withoutTags = text.replace(/<[^>]*>/g, "").trim()
    return withoutTags || ""
  }

  useEffect(() => {
    if (searchParams?.get("blocked")) {
      setBlockedModalOpen(true)
    }
  }, [searchParams])

  const handleContactSupport = () => {
    setBlockedModalOpen(false)
    router.push("/support")
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setIsLoading(true)

    startTask()
    try {
      let identifier = formData.email.trim().toLowerCase()
      if (!identifier) {
        setError("Email is required")
        setIsLoading(false)
        return
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier,
          identifierType: "email",
          password: formData.password,
        }),
      })

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
      let parsed: Record<string, unknown> | null = null
      let fallbackText = ""

      if (contentType.includes("application/json")) {
        parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null
      } else {
        fallbackText = (await response.text().catch(() => "")) || ""
      }

      const success = Boolean(parsed?.success)

      if (response.status === 403 && parsed?.blocked) {
        setBlockedModalOpen(true)
        setError("")
        return
      }

      if (!response.ok || !success) {
        const backendMessage =
          (typeof parsed?.error === "string" && parsed.error) ||
          (typeof parsed?.message === "string" && parsed.message) ||
          fallbackText

        const fallbackMessage =
          response.status === 401 || response.status === 403
            ? "Incorrect email or password."
            : "Login failed. Please try again."

        setError(sanitizeMessage(backendMessage) || fallbackMessage)
        return
      }

      router.replace("/dashboard")
      router.refresh()
    } catch (submitError) {
      console.error("Login error", submitError)
      const message =
        submitError instanceof Error && submitError.name !== "AbortError"
          ? submitError.message
          : ""

      if (message && /fetch failed|network|request|failed to fetch/i.test(message)) {
        setError("Server not reachable. Please try later.")
      } else if (message) {
        setError(message)
      } else {
        setError("Server not reachable. Please try later.")
      }
    } finally {
      stopTask()
      setIsLoading(false)
    }
  }

  return (
    <div className="relative isolate w-full overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 shadow-2xl shadow-primary/20">
      <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_10%_20%,rgba(56,189,248,0.14),transparent_35%),radial-gradient(circle_at_90%_10%,rgba(168,85,247,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.18),transparent_35%)]" />
      <div className="absolute -left-20 top-12 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-24 -top-16 h-60 w-60 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative grid gap-10 p-8 md:grid-cols-[1fr,1.05fr] lg:p-12">
        <div className="space-y-6 md:self-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
              <UserRoundPlus className="h-4 w-4" />
            </span>
            Sign in to referrals
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight text-white drop-shadow-sm">
              Modern, distraction-free login for your referral dashboard
            </h1>
            <p className="text-sm leading-relaxed text-slate-200/80">
              Sign in with your email and pick up right where you left off. One clean, secure session—no phone details needed.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Adaptive security</p>
                <p className="text-xs text-slate-200/70">We detect blocked accounts early to protect your referrals.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
          <div className="absolute right-6 top-6 h-10 w-10 rounded-full bg-primary/10 blur-xl" />
          <div className="absolute left-4 bottom-6 h-10 w-10 rounded-full bg-accent/10 blur-xl" />
          <div className="relative space-y-6">
            <div className="space-y-1 text-left">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-200/70">Login</p>
              <p className="text-lg font-semibold text-white">Access your referral space</p>
            </div>

            {error && (
              <Alert variant="destructive" className="border-red-400/40 bg-red-500/10 text-red-50">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                  className="h-12 rounded-xl border-white/10 bg-slate-900/70 text-white placeholder:text-slate-400"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                  Password
                </Label>
                <PasswordInput
                  id="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  className="h-12 rounded-xl border-white/10 bg-slate-900/70 text-white placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/auth/forgot"
                  className="text-sm font-medium text-primary underline-offset-4 transition hover:text-primary/80"
                >
                  Forgot Password?
                </Link>
                <div className="flex w-full gap-3 sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-white/30 bg-transparent text-white hover:bg-white/5 sm:flex-none"
                    onClick={() => router.push("/auth/register")}
                  >
                    Create Account
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-accent text-slate-950 shadow-lg shadow-primary/30 transition-all duration-200 hover:shadow-2xl sm:flex-none"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      <Dialog open={blockedModalOpen} onOpenChange={setBlockedModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Account Blocked</DialogTitle>
            <DialogDescription>
              Your account has been blocked by an administrator. For more information, contact Support.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start">
            <Button onClick={handleContactSupport} className="w-full">
              Contact Support
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
