"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, Radio, ShieldCheck, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"

import {
  ADMIN_NAV_ITEM,
  LOGOUT_NAV_ITEM,
  SIDE_NAV_ITEMS,
} from "@/components/layout/nav-config"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface SidebarProps {
  user?: {
    name: string
    email: string
    referralCode: string
    role?: string
    profileAvatar?: string
  }
  onLogout?: () => void
  isLoggingOut?: boolean
}

export function Sidebar({ user, onLogout, isLoggingOut }: SidebarProps) {
  const pathname = usePathname() ?? "/"
  const [collapsed, setCollapsed] = useState(false)

  const initials = useMemo(() => {
    if (!user?.name) return "5G"
    return user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase())
      .join("")
  }, [user?.name])

  const navItemClasses = (isActive: boolean) =>
    cn(
      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
      isActive
        ? "bg-gradient-to-r from-cyan-500/25 via-emerald-400/20 to-blue-500/25 text-white shadow-[0_10px_30px_-15px_rgba(34,211,238,0.6)] border border-cyan-400/50"
        : "text-slate-300 border border-transparent hover:-translate-y-[1px] hover:border-cyan-400/20 hover:bg-slate-900/60 hover:text-white",
    )

  const renderNavLink = (item: (typeof SIDE_NAV_ITEMS)[number]) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
    return (
      <Link
        key={item.href}
        href={item.href}
        className={navItemClasses(isActive)}
        aria-current={isActive ? "page" : undefined}
        prefetch={item.href === "/team" ? true : undefined}
      >
        <div className="flex size-9 items-center justify-center rounded-lg border border-slate-800/70 bg-slate-900/70 text-cyan-200">
          <item.icon className="h-4 w-4" aria-hidden />
        </div>
        {!collapsed && <span className="truncate">{item.name}</span>}
      </Link>
    )
  }

  const renderAdmin = () => {
    if (user?.role?.toLowerCase() !== "admin") return null
    const isActive = pathname === ADMIN_NAV_ITEM.href || pathname.startsWith(`${ADMIN_NAV_ITEM.href}/`)
    return (
      <Link
        key={ADMIN_NAV_ITEM.href}
        href={ADMIN_NAV_ITEM.href}
        className={navItemClasses(isActive)}
        aria-current={isActive ? "page" : undefined}
      >
        <div className="flex size-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-100">
          <ADMIN_NAV_ITEM.icon className="h-4 w-4" aria-hidden />
        </div>
        {!collapsed && <span className="truncate">Admin Panel</span>}
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 hidden h-screen shrink-0 border-r border-slate-800/80 bg-slate-950/80 backdrop-blur md:flex",
        collapsed ? "w-[5.25rem]" : "w-72",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-full w-full flex-col px-3 py-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/30 px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="relative flex size-11 items-center justify-center rounded-xl border border-slate-800/70 bg-gradient-to-br from-emerald-400/20 via-cyan-400/10 to-blue-500/10 text-cyan-200 shadow-lg shadow-emerald-500/15">
              <span className="text-lg font-black drop-shadow">5G</span>
              <span className="absolute -bottom-1 left-1 h-1 w-6 rounded-full bg-emerald-400/70" />
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <span className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/80">Signal grid</span>
                <div className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                  5gbotify
                  <span className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-200">live</span>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="size-9 rounded-lg border border-slate-800/80 bg-slate-900/60 text-slate-300 hover:text-white"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
          </Button>
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-hidden">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border border-slate-800">
                {user?.profileAvatar ? (
                  <AvatarImage src={user.profileAvatar} alt={user.name ?? "User avatar"} />
                ) : (
                  <AvatarFallback className="bg-slate-900 text-xs font-semibold uppercase text-white">{initials}</AvatarFallback>
                )}
              </Avatar>
              {!collapsed && (
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">{user?.name ?? "Admin User"}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden />
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                      {user?.role ? user.role : "Tier 1"}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {!collapsed && (
              <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wide text-cyan-200/80">
                <Radio className="h-4 w-4 animate-pulse text-emerald-300" aria-hidden />
                Connected to Pulse Reactor Grid
              </div>
            )}
          </div>

          <nav aria-label="Primary navigation" className="space-y-2">
            {SIDE_NAV_ITEMS.map(renderNavLink)}
            {renderAdmin()}
          </nav>
        </div>

        <div className="space-y-3 pb-[env(safe-area-inset-bottom)]">
          <Separator className="border-slate-800/70" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl border border-slate-800/70 bg-slate-900/60 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-400/40 hover:bg-slate-900/80 hover:text-white"
            onClick={() => onLogout?.()}
            disabled={isLoggingOut}
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500/30 via-orange-400/20 to-amber-400/20 text-red-100">
              <LOGOUT_NAV_ITEM.icon className="h-4 w-4" aria-hidden />
            </div>
            {!collapsed && <span>{isLoggingOut ? "Signing out..." : LOGOUT_NAV_ITEM.name}</span>}
          </Button>
          {!collapsed && (
            <p className="text-center text-[11px] text-slate-400">
              Secure session with neon-grade shielding
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}
