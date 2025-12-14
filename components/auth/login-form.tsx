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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SORTED_COUNTRY_DIAL_CODES } from "@/lib/constants/country-codes"

const PHONE_REGEX = /^\+[1-9]\d{7,14}$/

interface LoginFormData {
  email: string
  countryCode: string
  phone: string
  password: string
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { startTask, stopTask } = useTopLoader()
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    countryCode: "+1",
    phone: "",
    password: "",
  })
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email")
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
      let identifierType: "email" | "phone" = "email"

      if (authMethod === "phone") {
        const cleanedPhone = formData.phone.replace(/\D/g, "")
        const normalizedPhone = `${formData.countryCode}${cleanedPhone}`

        if (!PHONE_REGEX.test(normalizedPhone)) {
          setError("Please enter a valid international phone number")
          setIsLoading(false)
          return
        }

        identifier = normalizedPhone
        identifierType = "phone"
      } else if (!identifier) {
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
          identifierType,
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
    <div className="relative isolate w-full max-w-4xl overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 shadow-2xl shadow-primary/20">
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
              Choose how you want to authenticate and pick up right where you left off. Phone and email logins share the same secure session.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Multi-channel access</p>
                <p className="text-xs text-slate-200/70">Switch between email or phone without losing your progress.</p>
              </div>
            </div>
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
              <Tabs
                value={authMethod}
                onValueChange={(value) => {
                  setAuthMethod(value as "email" | "phone")
                  setError("")
                }}
                className="space-y-4"
              >
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-white/5 p-1 text-sm">
                  <TabsTrigger
                    value="email"
                    className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-slate-950"
                  >
                    Email
                  </TabsTrigger>
                  <TabsTrigger
                    value="phone"
                    className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-slate-950"
                  >
                    Phone
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-3">
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
                  />
                </TabsContent>

                <TabsContent value="phone" className="space-y-3">
                  <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                    Phone Number
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={formData.countryCode}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, countryCode: value }))}
                    >
                      <SelectTrigger className="h-12 rounded-xl border-white/10 bg-slate-900/70 text-left text-white sm:w-44">
                        <SelectValue placeholder="Country" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {SORTED_COUNTRY_DIAL_CODES.map((country) => (
                          <SelectItem key={country.isoCode} value={country.dialCode}>
                            {country.name} ({country.dialCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      inputMode="tel"
                      placeholder="123 456 789"
                      value={formData.phone}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, phone: event.target.value.replace(/[^\d]/g, "") }))
                      }
                      className="h-12 flex-1 rounded-xl border-white/10 bg-slate-900/70 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <p className="text-xs text-slate-200/70">Use the number you registered with, including the country code.</p>
                </TabsContent>
              </Tabs>

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
