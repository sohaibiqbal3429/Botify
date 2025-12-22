// @ts-nocheck
"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu } from "lucide-react"

import { AUTH_HIDDEN_ROUTES } from "@/components/layout/quick-actions"
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer"
import { PRIMARY_NAV_ITEMS } from "@/components/layout/nav-config"
import { cn } from "@/lib/utils"
import { Button } from "../ui/button"

export function AppHeader() {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // ✅ Sign out -> clears session (api) -> redirect to /auth/login
  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include", // ✅ ensures cookie is included/cleared
      })
    } catch (error) {
      console.error("Logout error", error)
    } finally {
      setDrawerOpen(false)
      router.replace("/auth/login") // ✅ prevent back navigation to protected pages
      router.refresh() // ✅ re-check auth state immediately
    }
  }, [router])

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  if (shouldHide) return null

  return (
    <>
      <header
        className="sticky top-0 z-[100] border-b border-slate-800/80 bg-slate-950/80 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.85)] backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-16 w-full items-center gap-4 px-3 md:px-6">
          {/* Left: brand & mobile trigger */}
          <div className="flex items-center gap-3 whitespace-nowrap">
            {/* ✅ Mobile menu button */}
            <button
              ref={menuButtonRef}
              type="button"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-800/70 bg-slate-900 text-slate-100 transition hover:border-cyan-400/60 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:hidden"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            {/* Logo */}
            <Link href="/" className="group flex items-center gap-3" prefetch>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-[0.42em] text-slate-400">
                    Signal Grid
                  </span>
                  <span className="h-1 w-1 rounded-full bg-emerald-300/70" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.34em] text-slate-500">
                    Beta
                  </span>
                </div>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-semibold tracking-tight text-white">
                    5GBOTIFY
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Live
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Center: nav links */}
          <nav className="hidden md:flex md:flex-1 md:justify-center">
            <div className="flex flex-1 items-center justify-center gap-4 overflow-x-auto whitespace-nowrap md:gap-6">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                      isActive
                        ? "bg-gradient-to-r from-cyan-500/20 to-emerald-400/20 text-white shadow-inner shadow-cyan-500/10"
                        : "text-slate-300 hover:-translate-y-[1px] hover:bg-slate-800/60 hover:text-white",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* Right: actions */}
          <div className="ml-auto hidden items-center gap-3 whitespace-nowrap md:flex">
            <Button
              variant="ghost"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/60 hover:text-white"
              onClick={() => void handleLogout()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* ✅ Mobile drawer */}
      <MobileNavDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        anchorRef={menuButtonRef}
      />
    </>
  )
}
