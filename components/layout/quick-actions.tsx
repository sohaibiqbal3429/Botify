"use client"

export const AUTH_HIDDEN_ROUTES = [
  /^\/login(?:\/.*)?$/,
  /^\/signin(?:\/.*)?$/,
  /^\/signup(?:\/.*)?$/,
  /^\/forgot-password(?:\/.*)?$/,
  /^\/auth\/(?:login|register|forgot|verify-otp)(?:\/.*)?$/,
]

type QuickActionsVariant = "mobile" | "desktop" | "both"

type QuickActionsProps = {
  mobileClassName?: string
  variant?: QuickActionsVariant
}

export default function QuickActions({ mobileClassName, variant = "both" }: QuickActionsProps = {}) {
  // Quick actions are disabled site-wide.
  return null
}
