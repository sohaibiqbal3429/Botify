"use client"

import { type FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw, UserPlus } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { OTPInput } from "@/components/auth/otp-input"
import { formatOTPSuccessMessage, type OTPSuccessPayload } from "@/lib/utils/otp-messages"

interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  referralCode: string
}

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [step, setStep] = useState<"details" | "otp">("details")
  const [otpValue, setOtpValue] = useState("")
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [isResending, setIsResending] = useState(false)

  // Prefill referral code from query param (?ref= or ?referral=), once on mount / when URL changes
  useEffect(() => {
    const fromRef = (searchParams.get("ref") || searchParams.get("referral") || "").trim()
    if (fromRef && !formData.referralCode) {
      setFormData((prev) => ({ ...prev, referralCode: fromRef.toUpperCase() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]) // don't include formData in deps to avoid unnecessary resets

  useEffect(() => {
    if (otpCountdown <= 0) return

    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [otpCountdown])

  const normalizedEmail = useMemo(() => formData.email.trim().toLowerCase(), [formData.email])

  const resetOTPState = () => {
    setStep("details")
    setOtpValue("")
    setOtpCountdown(0)
    setIsResending(false)
    setInfoMessage("")
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    if (step !== "otp") {
      setInfoMessage("")
    }

    if (step === "details") {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match")
        return
      }

      setIsLoading(true)

      try {
        const response = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            purpose: "registration",
          }),
        })

        const data = (await response.json().catch(() => ({}))) as OTPSuccessPayload & { error?: string }

        if (!response.ok) {
          setError(data.message || data.error || "Failed to send verification code")
          return
        }

        setInfoMessage(
          formatOTPSuccessMessage(
            data,
            "Verification code sent to your email. Enter it below to verify your account.",
          ),
        )
        setStep("otp")
        setOtpValue("")
        setOtpCountdown(60)
      } catch (submitError) {
        console.error("Send OTP error", submitError)
        setError("Network error. Please try again.")
      } finally {
        setIsLoading(false)
      }

      return
    }

    if (otpValue.length !== 6) {
      setError("Please enter the 6-digit verification code")
      return
    }

    setIsLoading(true)

    try {
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: otpValue,
          email: normalizedEmail,
          purpose: "registration",
        }),
      })

      const verifyData = await verifyResponse.json().catch(() => ({}))

      if (!verifyResponse.ok) {
        const parsedError = verifyData as { error?: string; message?: string }
        setError(parsedError.message || parsedError.error || "Verification failed")
        return
      }

      const registerResponse = await fetch("/api/auth/register-with-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: normalizedEmail,
          password: formData.password,
          referralCode: formData.referralCode.trim().toUpperCase(),
          otpCode: otpValue,
        }),
      })

      const registerData = await registerResponse.json().catch(() => ({}))

      if (!registerResponse.ok) {
        const parsedError = registerData as { error?: string; message?: string }
        setError(parsedError?.message || parsedError?.error || "Registration failed")
        return
      }

      router.push("/dashboard")
    } catch (submitError) {
      console.error("Registration with OTP error", submitError)
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (isResending || step !== "otp") return

    setError("")
    setInfoMessage("")
    setIsResending(true)

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          purpose: "registration",
        }),
      })

      const data = (await response.json().catch(() => ({}))) as OTPSuccessPayload & { error?: string; message?: string }

      if (!response.ok) {
        setError(data.message || data.error || "Failed to resend code")
        return
      }

      setInfoMessage(formatOTPSuccessMessage(data, "A new verification code has been sent to your email."))
      setOtpValue("")
      setOtpCountdown(60)
    } catch (resendError) {
      console.error("Resend OTP error", resendError)
      setError("Network error. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="relative isolate w-full overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 shadow-2xl shadow-primary/20">
      <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.2),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.16),transparent_32%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.15),transparent_34%)]" />
      <div className="absolute -right-16 top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative grid gap-10 p-8 md:grid-cols-[1.05fr,1fr] lg:p-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
              <UserPlus className="h-4 w-4" />
            </span>
            Start your referral journey
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight text-white drop-shadow-sm">
              Create an account with a fresh, split-panel experience
            </h1>
            <p className="text-sm leading-relaxed text-slate-200/80">
              We separated guidance from actions so you can stay focused. Complete your details, verify with email, and secure your referral perks.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">1</span>
              <div>
                <p className="text-sm font-semibold text-white">Add your details</p>
                <p className="text-xs text-slate-200/70">Name, email, and a referral code you received.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">2</span>
              <div>
                <p className="text-sm font-semibold text-white">Verify ownership</p>
                <p className="text-xs text-slate-200/70">We send a short-lived code to your inbox. Enter it to continue.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">3</span>
              <div>
                <p className="text-sm font-semibold text-white">Join the program</p>
                <p className="text-xs text-slate-200/70">Access the referral dashboard and begin inviting others.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/15 bg-slate-950/70 p-6 shadow-2xl backdrop-blur">
          <div className="absolute left-6 top-6 h-10 w-10 rounded-full bg-primary/10 blur-xl" />
          <div className="absolute right-10 bottom-10 h-10 w-10 rounded-full bg-accent/10 blur-xl" />
          <div className="relative space-y-6">
            <div className="space-y-1 text-left">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-200/70">Create Account</p>
              <p className="text-lg font-semibold text-white">Verify and activate your referral profile</p>
            </div>

            {error && (
              <Alert variant="destructive" className="border-red-400/40 bg-red-500/10 text-red-50">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {infoMessage && (
              <Alert className="border-white/20 bg-white/5 text-white">
                <AlertDescription>{infoMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                    Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter name"
                    value={formData.name}
                    onChange={(event) => {
                      setFormData((prev) => ({ ...prev, name: event.target.value }))
                      if (step === "otp") {
                        resetOTPState()
                      }
                    }}
                    required
                    className="h-12 rounded-xl border-white/10 bg-slate-900/70 text-white placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email"
                    value={formData.email}
                    onChange={(event) => {
                      setFormData((prev) => ({ ...prev, email: event.target.value }))
                      if (step === "otp") {
                        resetOTPState()
                      }
                    }}
                    required
                    className="h-12 rounded-xl border-white/10 bg-slate-900/70 text-white placeholder:text-slate-400"
                    disabled={step === "otp"}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                    Password
                  </Label>
                  <PasswordInput
                    id="password"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(event) => {
                      setFormData((prev) => ({ ...prev, password: event.target.value }))
                      if (step === "otp") {
                        resetOTPState()
                      }
                    }}
                    required
                    minLength={6}
                    className="h-12 rounded-xl border-white/10 bg-slate-900/70 text-white placeholder:text-slate-400"
                    disabled={step === "otp"}
                  />
                </div>

                <div className="space-y-3">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80"
                  >
                    Re-enter Password
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(event) => {
                      setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                      if (step === "otp") {
                        resetOTPState()
                      }
                    }}
                    required
                    minLength={6}
                    className="h-12 rounded-xl border-white/10 bg-slate-900/70 text-white placeholder:text-slate-400"
                    disabled={step === "otp"}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="referralCode" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                  Referral Code
                </Label>
                <Input
                  id="referralCode"
                  type="text"
                  placeholder="Enter referral code (required)"
                  value={formData.referralCode}
                  onChange={(event) => {
                    setFormData((prev) => ({ ...prev, referralCode: event.target.value.toUpperCase() }))
                    if (step === "otp") {
                      resetOTPState()
                    }
                  }}
                  required
                  disabled={step === "otp"}
                  className="h-12 rounded-xl border-white/10 bg-slate-900/70 text-white placeholder:text-slate-400"
                />
              </div>

              {step === "otp" && (
                <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="space-y-2 text-center">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
                      Enter the 6-digit code
                    </Label>
                    <OTPInput value={otpValue} onChange={setOtpValue} disabled={isLoading} />
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2 text-xs text-slate-200/80 sm:flex-row">
                    <span>
                      {otpCountdown > 0 ? `You can request a new code in ${otpCountdown}s` : "Didn't get the code?"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResendOTP}
                      disabled={isResending || otpCountdown > 0}
                      className="h-8 px-2 text-white hover:bg-white/10"
                    >
                      {isResending ? (
                        <>
                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Resending...
                        </>
                      ) : (
                        "Resend code"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {step === "details" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-white/30 bg-transparent text-white hover:bg-white/5 sm:w-auto"
                    onClick={() => router.push("/auth/forgot")}
                  >
                    Forgot Password?
                  </Button>
                )}

                <Button
                  type="submit"
                  className="h-11 flex-1 rounded-xl bg-gradient-to-r from-primary to-accent text-slate-950 shadow-lg shadow-primary/30 transition-all duration-200 hover:shadow-2xl sm:flex-none"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {step === "details" ? "Sending Code..." : "Verifying..."}
                    </>
                  ) : step === "details" ? (
                    "Send Verification Code"
                  ) : (
                    "Verify & Create Account"
                  )}
                </Button>
              </div>
            </form>

            <p className="text-center text-sm text-slate-200/80">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-semibold text-primary hover:underline">
                Login instead
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
