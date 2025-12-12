"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  BellDot,
  Cog,
  HelpCircle,
  LogOut,
  Loader2,
  Menu,
  TimerReset,
  User,
  Wallet,
} from "lucide-react"

import {
  ACCOUNT_CENTER_NAV,
  GLOBAL_UTILITY_NAV,
  UTILITY_NAV_ITEMS,
} from "@/components/layout/nav-config"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  user?: {
    name: string
    email: string
    referralCode: string
    role?: string
    profileAvatar?: string
  }
  onLogout: () => void
  isLoggingOut: boolean
  onOpenMobileNav: () => void
  menuButtonRef: React.RefObject<HTMLButtonElement>
}

export function AppHeader({ user, onLogout, isLoggingOut, onOpenMobileNav, menuButtonRef }: AppHeaderProps) {
  const pathname = usePathname() ?? "/"

  const initials = user?.name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("")

  const renderUtility = (item: (typeof UTILITY_NAV_ITEMS)[number]) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        className={cn(
          "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
          "border-slate-800/70 bg-slate-900/70 text-slate-200 hover:border-cyan-400/40 hover:text-white",
          isActive && "border-cyan-400/70 bg-cyan-500/15 text-white shadow-[0_10px_40px_-24px_rgba(34,211,238,0.9)]",
        )}
      >
        <item.icon className="h-4 w-4 text-cyan-200" aria-hidden />
        <span className="hidden md:inline">{item.name}</span>
      </Link>
    )
  }

  const quickItems = [
    {
      label: "Activity Timeline",
      href: GLOBAL_UTILITY_NAV[0].href,
      icon: Activity,
      badge: 3,
    },
    {
      label: "Help Desk",
      href: GLOBAL_UTILITY_NAV[1].href,
      icon: HelpCircle,
      badge: 1,
    },
  ]

  return (
    <header
      className="sticky top-0 z-[90] border-b border-slate-800/80 bg-slate-950/80 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.85)] backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-3 md:px-6 lg:px-8">
        <button
          ref={menuButtonRef}
          type="button"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-800/70 bg-slate-900 text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:hidden"
          aria-label="Open menu"
          onClick={onOpenMobileNav}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <div className="hidden flex-1 items-center gap-2 md:flex">
          <div className="hidden items-center gap-2 lg:flex">{UTILITY_NAV_ITEMS.map(renderUtility)}</div>
          <div className="flex items-center gap-2 lg:ml-3">
            {quickItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={cn(
                    "relative flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/70 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:text-white",
                    isActive && "border-cyan-400/70 bg-cyan-500/10 text-white",
                  )}
                >
                  <Icon className="h-4 w-4 text-cyan-200" aria-hidden />
                  <span className="hidden sm:inline">{item.label}</span>
                  <Badge className="absolute -right-2 -top-2 h-5 min-w-[1.5rem] rounded-full bg-emerald-500/80 px-1 text-[11px] font-bold text-white shadow shadow-emerald-500/40">
                    {item.badge}
                  </Badge>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-800/70 bg-slate-900/60 text-slate-200 hover:border-cyan-400/60 hover:text-white sm:inline-flex"
            asChild
          >
            <Link href={UTILITY_NAV_ITEMS[1].href} prefetch aria-label="Wallet Hub">
              <Wallet className="h-5 w-5" aria-hidden />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-800/70 bg-slate-900/60 text-slate-200 hover:border-cyan-400/60 hover:text-white sm:inline-flex"
            asChild
          >
            <Link href={GLOBAL_UTILITY_NAV[0].href} prefetch aria-label="Activity timeline">
              <TimerReset className="h-5 w-5" aria-hidden />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-800/70 bg-slate-900/60 text-slate-200 hover:border-cyan-400/60 hover:text-white sm:inline-flex"
            asChild
          >
            <Link href={GLOBAL_UTILITY_NAV[1].href} prefetch aria-label="Help desk">
              <HelpCircle className="h-5 w-5" aria-hidden />
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/70 px-2 py-1.5 text-left text-slate-50 shadow-[0_12px_40px_-28px_rgba(8,47,73,0.9)] hover:border-cyan-400/50 hover:text-white"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10 border border-slate-800">
                    {user?.profileAvatar ? (
                      <AvatarImage src={user.profileAvatar} alt={user.name ?? "User avatar"} />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 text-xs font-semibold uppercase text-white">
                        {initials ?? "5G"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="absolute -bottom-1 -right-1 inline-flex items-center rounded-full bg-emerald-500/90 px-1.5 text-[10px] font-bold uppercase text-slate-900">
                    {user?.role ?? "Tier 1"}
                  </span>
                </div>
                <div className="hidden flex-col text-left leading-tight sm:flex">
                  <span className="text-sm font-semibold">{user?.name ?? "Admin User"}</span>
                  <span className="text-xs text-slate-300">Account Center</span>
                </div>
                <BellDot className="h-5 w-5 text-emerald-300" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[240px] border-slate-800/70 bg-slate-950/95 text-slate-50">
              <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wide text-cyan-100">
                <User className="h-4 w-4" aria-hidden /> Profile Stack
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="border-slate-800/70" />
              <DropdownMenuItem asChild>
                <Link href={ACCOUNT_CENTER_NAV.href} prefetch className="flex items-center gap-2">
                  <User className="h-4 w-4" aria-hidden />
                  <span>Account Center</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`${ACCOUNT_CENTER_NAV.href}/settings`} prefetch className="flex items-center gap-2">
                  <Cog className="h-4 w-4" aria-hidden />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="border-slate-800/70" />
              <DropdownMenuItem onSelect={() => onLogout()} className="flex items-center gap-2 text-red-200 focus:text-red-100">
                {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
                <span>{isLoggingOut ? "Signing out..." : "Sign out"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
