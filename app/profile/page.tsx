"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { BadgeCheck, CheckCircle, Copy, Key, Loader2, Mail, Sparkles, User } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { SerializableUser } from "@/lib/serializers/user"
import { PROFILE_AVATAR_OPTIONS } from "@/lib/constants/avatars"
import { ACTIVE_DEPOSIT_THRESHOLD } from "@/lib/constants/bonuses"
import { formatOTPSuccessMessage, type OTPSuccessPayload } from "@/lib/utils/otp-messages"

type StatusMessage = { success?: string; error?: string }

const toNumber = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined) return fallback
  if (typeof v === "number") return v
  const n = Number((v as any).toString?.() ?? v)
  return Number.isFinite(n) ? n : fallback
}
const usd = (v: unknown) => `$${toNumber(v).toFixed(2)}`

export default function ProfilePage() {
  const router = useRouter()

  const [user, setUser] = useState<SerializableUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState("")
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [copied, setCopied] = useState(false)

  const [profileStatus, setProfileStatus] = useState<StatusMessage>({})
  const [verificationStatus, setVerificationStatus] = useState<StatusMessage>({})
  const [passwordStatus, setPasswordStatus] = useState<StatusMessage>({})
  const [otpStatus, setOtpStatus] = useState<StatusMessage>({})

  const [profileLoading, setProfileLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    avatar: PROFILE_AVATAR_OPTIONS[0]?.value ?? "avatar-01",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    otpCode: "",
  })

  const syncUserState = (nextUser: SerializableUser) => {
    setUser(nextUser)
    setProfileData({
      name: nextUser.name || "",
      email: nextUser.email || "",
      phone: nextUser.phone || "",
      avatar: nextUser.profileAvatar || PROFILE_AVATAR_OPTIONS[0]?.value || "avatar-01",
    })
  }

  const selectedAvatar = user?.profileAvatar || PROFILE_AVATAR_OPTIONS[0]?.value || "avatar-01"
  const isBlocked = Boolean(user?.isBlocked)
  const isActiveAccount = Boolean(user?.isActive)
  const lifetimeDeposits = toNumber(user?.depositTotal)
  const threshold = toNumber(ACTIVE_DEPOSIT_THRESHOLD, 80)
  const remainingToActivate = Math.max(0, threshold - lifetimeDeposits)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (!userRes.ok) {
          setGlobalError("Failed to load user data")
          return
        }
        const response = await userRes.json()
        const fetchedUser: SerializableUser | null = response.user || null
        if (fetchedUser) {
          syncUserState(fetchedUser)
        } else {
          setGlobalError("Failed to load user data")
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
        setGlobalError("Failed to load user data")
      } finally {
        setLoading(false)
      }
    }

    fetchData().catch((error) => {
      console.error("Unexpected fetch error:", error)
      setGlobalError("Failed to load user data")
      setLoading(false)
    })
  }, [])

  const handleProfileUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileLoading(true)
    setProfileStatus({})
    setGlobalError("")

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileData.name,
          avatar: profileData.avatar,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || "Failed to update profile")
      if (data.user) syncUserState(data.user as SerializableUser)

      setProfileStatus({ success: data.message || "Profile updated successfully." })
      setVerificationStatus({})
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Failed to update profile"
      setProfileStatus({ error: message })
    } finally {
      setProfileLoading(false)
    }
  }

  const handleVerifyProfile = async () => {
    setVerificationStatus({})
    setGlobalError("")

    setVerificationStatus({ error: "Phone verification is disabled. Email login is already active." })
  }

  const handleSendPasswordOtp = async () => {
    if (!profileData.email) {
      setOtpStatus({ error: "Add an email address to your profile before requesting a code" })
      return
    }

    setOtpLoading(true)
    setOtpStatus({})
    try {
      const response = await fetch("/api/auth/otp?context=password_reset", { method: "POST" })
      const data: OTPSuccessPayload = await response.json()
      if (!response.ok) {
        throw new Error((data as any)?.error || "Failed to send verification code")
      }
      setOtpStatus({ success: formatOTPSuccessMessage(data, "Verification code sent") })
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Failed to send verification code"
      setOtpStatus({ error: message })
    } finally {
      setOtpLoading(false)
    }
  }

  const handlePasswordUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordStatus({ error: "New passwords do not match" })
      return
    }
    if (!passwordData.otpCode) {
      setPasswordStatus({ error: "Enter the 6-digit verification code we emailed you" })
      return
    }

    setPasswordLoading(true)
    setPasswordStatus({})
    setOtpStatus({})
    setGlobalError("")

    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
          otpCode: passwordData.otpCode,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || "Failed to update password")

      setPasswordStatus({ success: data.message || "Password updated successfully." })
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "", otpCode: "" })
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Failed to update password"
      setPasswordStatus({ error: message })
    } finally {
      setPasswordLoading(false)
    }
  }

  const buildAuthUrl = (referralCode: string) => {
    const AUTH_PATH = "/auth/register"
    const url = new URL(AUTH_PATH, window.location.origin)
    url.searchParams.set("ref", referralCode)
    return url.toString()
  }

  const copyReferralLink = async () => {
    if (!user?.referralCode) {
      setGlobalError("No referral code available")
      return
    }

    setIsGeneratingLink(true)
    setCopied(false)
    setGlobalError("")

    try {
      const referralCode = String(user.referralCode).trim()
      const referralLink = buildAuthUrl(referralCode)
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      router.push(referralLink)
    } catch (error) {
      console.error("Error generating/copying referral link:", error)
      setGlobalError("Failed to copy or open the referral link")
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const copyReferralCode = async () => {
    if (user?.referralCode) {
      try {
        await navigator.clipboard.writeText(user.referralCode)
        setCopied(true)
      } catch (error) {
        console.error("Failed to copy referral code:", error)
        setGlobalError("Failed to copy referral code")
      }
    } else {
      setGlobalError("No referral code available")
    }
  }

  const verificationFlags = [
    { label: "Email verified", active: Boolean(user?.emailVerified) },
    { label: "Account active", active: isActiveAccount },
  ]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.08),transparent_40%)]" />

        <main className="relative mx-auto flex w-full flex-col gap-8 px-4 py-10 lg:px-6">
          <header className="flex flex-col gap-4 rounded-3xl border border-emerald-500/20 bg-slate-900/70 p-6 shadow-lg shadow-emerald-500/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-emerald-400/30 bg-slate-950">
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">Profile</p>
                  <h1 className="text-2xl font-semibold text-white">{user?.name || "Account owner"}</h1>
                  <p className="text-sm text-emerald-100/80">
                    Tier {toNumber(user?.level, 0)} | {isActiveAccount ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {verificationFlags.map((flag) => (
                  <Badge
                    key={flag.label}
                    variant={flag.active ? "default" : "outline"}
                    className="flex items-center gap-1"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {flag.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Deposits</p>
                <p className="mt-2 text-xl font-semibold text-white">{usd(user?.depositTotal)}</p>
                <p className="text-xs text-slate-500">
                  {remainingToActivate > 0 ? `${usd(remainingToActivate)} to reach activation threshold` : "Activation threshold met"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Withdrawn</p>
                <p className="mt-2 text-xl font-semibold text-white">{usd(user?.withdrawTotal)}</p>
                <p className="text-xs text-slate-500">Total processed withdrawals</p>
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Earnings</p>
                <p className="mt-2 text-xl font-semibold text-white">{usd(user?.roiEarnedTotal)}</p>
                <p className="text-xs text-slate-500">Lifetime rewards earned</p>
              </div>
            </div>
          </header>

          {globalError && (
            <Alert variant="destructive">
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900/60">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="referral">Referral</TabsTrigger>
            </TabsList>

            {/* âœ… FIXED PROFILE TAB */}
            <TabsContent value="profile" className="mt-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                {/* LEFT */}
                <Card className="border-slate-800/70 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle>Profile details</CardTitle>
                    <CardDescription>Update your display name, phone, and avatar.</CardDescription>
                  </CardHeader>

                  <CardContent>
                    {profileStatus.error && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{profileStatus.error}</AlertDescription>
                      </Alert>
                    )}
                    {profileStatus.success && (
                      <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-900">
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>{profileStatus.success}</AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full name</Label>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <Input
                              id="name"
                              value={profileData.name}
                              onChange={(event) =>
                                setProfileData((prev) => ({ ...prev, name: event.target.value }))
                              }
                              required
                            />
                          </div>
                        </div>

                      </div>

                      <div className="space-y-2">
                        <Label>Email</Label>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <Input value={profileData.email} readOnly />
                          {user?.emailVerified && <Badge variant="secondary">Verified</Badge>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Avatar</Label>
                        <RadioGroup
                          value={profileData.avatar}
                          onValueChange={(value) =>
                            setProfileData((prev) => ({ ...prev, avatar: value }))
                          }
                          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                        >
                          {PROFILE_AVATAR_OPTIONS.map((opt) => (
                            <div
                              key={opt.value}
                              className="flex items-center gap-2 rounded-xl border border-slate-800/70 bg-slate-950/50 p-2"
                            >
                              <RadioGroupItem value={opt.value} id={opt.value} />
                              <Label htmlFor={opt.value} className="text-xs text-slate-200/80">
                                {opt.label ?? opt.value}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button type="submit" disabled={profileLoading}>
                          {profileLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save changes"
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleVerifyProfile}
                          disabled={verifyLoading}
                        >
                          {verifyLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            "Verify profile"
                          )}
                        </Button>
                      </div>

                      {verificationStatus.error && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertDescription>{verificationStatus.error}</AlertDescription>
                        </Alert>
                      )}
                      {verificationStatus.success && (
                        <Alert className="mt-3 border-emerald-200 bg-emerald-50 text-emerald-900">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>{verificationStatus.success}</AlertDescription>
                        </Alert>
                      )}
                    </form>
                  </CardContent>
                </Card>

                {/* RIGHT */}
                <Card className="border-slate-800/70 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-slate-900/80">
                  <CardHeader>
                    <CardTitle>Account health</CardTitle>
                    <CardDescription>Keep your account in good standing.</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/80 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-white">Status</p>
                        <p className="text-xs text-slate-400">
                          {isBlocked ? "Account blocked" : isActiveAccount ? "Active" : "Inactive"}
                        </p>
                      </div>
                      <Badge variant={isBlocked ? "destructive" : "default"}>
                        {isBlocked ? "Blocked" : isActiveAccount ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* Phone removed for email-only auth */}

                    <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-900/80 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-white">Email</p>
                        <p className="text-xs text-slate-400">{profileData.email}</p>
                      </div>
                      <Badge variant={user?.emailVerified ? "default" : "outline"}>
                        {user?.emailVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-6">
              <Card className="border-slate-800/70 bg-slate-900/70">
                <CardHeader>
                  <CardTitle>Password & verification</CardTitle>
                  <CardDescription>Secure your account with a new password and email code.</CardDescription>
                </CardHeader>
                <CardContent>
                  {otpStatus.error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{otpStatus.error}</AlertDescription>
                    </Alert>
                  )}
                  {otpStatus.success && (
                    <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-900">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>{otpStatus.success}</AlertDescription>
                    </Alert>
                  )}
                  {passwordStatus.error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{passwordStatus.error}</AlertDescription>
                    </Alert>
                  )}
                  {passwordStatus.success && (
                    <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>{passwordStatus.success}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current password</Label>
                      <PasswordInput
                        id="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={(event) =>
                          setPasswordData((prev) => ({ ...prev, currentPassword: event.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New password</Label>
                        <PasswordInput
                          id="newPassword"
                          value={passwordData.newPassword}
                          onChange={(event) =>
                            setPasswordData((prev) => ({ ...prev, newPassword: event.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm new password</Label>
                        <PasswordInput
                          id="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={(event) =>
                            setPasswordData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="otpCode">Email verification code</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSendPasswordOtp}
                          disabled={otpLoading}
                        >
                          {otpLoading ? (
                            <>
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              Sending
                            </>
                          ) : (
                            "Send code"
                          )}
                        </Button>
                      </div>

                      <Input
                        id="otpCode"
                        inputMode="numeric"
                        pattern="^\\d{6}$"
                        maxLength={6}
                        placeholder="123456"
                        value={passwordData.otpCode}
                        onChange={(event) =>
                          setPasswordData((prev) => ({
                            ...prev,
                            otpCode: event.target.value.replace(/[^0-9]/g, ""),
                          }))
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        We will email a 6-digit code to confirm this change.
                      </p>
                    </div>

                    <Button type="submit" disabled={passwordLoading}>
                      {passwordLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Key className="mr-2 h-4 w-4" />
                          Update password
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="referral" className="mt-6">
              <div className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
                <Card className="border-slate-800/70 bg-slate-900/70">
                  <CardHeader>
                    <CardTitle>Share & invite</CardTitle>
                    <CardDescription>Share your referral code to earn together.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Referral code</Label>
                      <div className="flex gap-2">
                        <Input value={user?.referralCode || ""} readOnly className="font-mono" />
                        <Button variant="outline" onClick={copyReferralCode} disabled={!user?.referralCode}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Referral link</Label>
                      <div className="flex gap-2">
                        <Button onClick={copyReferralLink} disabled={!user?.referralCode || isGeneratingLink}>
                          {isGeneratingLink ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Copy & open signup link
                            </>
                          )}
                        </Button>
                        {copied && <Badge variant="secondary">Copied</Badge>}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 p-4">
                      <p className="text-sm font-semibold text-white">Tips to boost referrals</p>
                      <ul className="mt-2 space-y-2 text-xs text-slate-400">
                        <li>Share with context: explain the daily profit mission and rewards.</li>
                        <li>Highlight activation thresholds and payout timelines.</li>
                        <li>Remind friends to verify email for smoother rewards.</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-800/70 bg-gradient-to-br from-slate-900/90 via-slate-900 to-emerald-900/30">
                  <CardHeader>
                    <CardTitle>Identity check</CardTitle>
                    <CardDescription>Keep your account secure with verification.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Phone verification</p>
                          <p className="text-xs text-slate-400">
                            Phone verification is disabled. Email-only login is active.
                          </p>
                        </div>
                        <Badge variant="outline">Disabled</Badge>
                      </div>
                      {verificationStatus.error && (
                        <p className="mt-2 text-xs text-red-400">{verificationStatus.error}</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Email verification</p>
                          <p className="text-xs text-slate-400">{profileData.email}</p>
                        </div>
                        <Badge variant={user?.emailVerified ? "default" : "outline"}>
                          {user?.emailVerified ? "Verified" : "Pending"}
                        </Badge>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Account status</p>
                          <p className="text-xs text-slate-400">{isBlocked ? "Blocked by admin" : "Good standing"}</p>
                        </div>
                        <Badge variant={isBlocked ? "destructive" : "default"}>
                          {isBlocked ? "Blocked" : "Clear"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
