"use client"

import { useMemo, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu } from "lucide-react"

import { AUTH_HIDDEN_ROUTES } from "@/components/layout/quick-actions"
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer"
import { PRIMARY_NAV_ITEMS } from "@/components/layout/nav-config"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/auth/login")
    }
  }, [router])

  if (shouldHide) return null

  return (
    <>
      <header className="sticky top-0 z-[100] border-b border-slate-800/80 bg-slate-950/80 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.85)] backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-3 md:px-6">
          {/* ... your existing left side ... */}

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const isLogout = item.href === "/logout"
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

              if (isLogout) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => void handleLogout()}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                      "text-slate-300 hover:-translate-y-[1px] hover:bg-slate-800/60 hover:text-white",
                    )}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    <span>{item.name}</span>
                  </button>
                )
              }

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
          </nav>

          <div className="ml-auto flex items-center gap-3" />
        </div>
      </header>

      <MobileNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} anchorRef={menuButtonRef} />
    </>
  )
}
