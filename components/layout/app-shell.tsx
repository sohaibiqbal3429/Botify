"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { KnowledgeSidebar } from "@/components/layout/knowledge-sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer"
import { Sidebar } from "@/components/layout/sidebar"
import { AUTH_HIDDEN_ROUTES } from "@/components/layout/quick-actions"

type ShellUser = {
  name: string
  email: string
  referralCode: string
  role?: string
  profileAvatar?: string
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [user, setUser] = useState<ShellUser | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const shouldHide = useMemo(
    () => AUTH_HIDDEN_ROUTES.some((pattern) => pattern.test(pathname)),
    [pathname],
  )

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null
        const payload = (await response.json()) as { user?: ShellUser }
        if (payload?.user) {
          setUser(payload.user)
        }
        return null
      })
      .catch((error) => {
        console.error("Failed to load user", error)
      })
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error("Failed to sign out")
      }
      router.push("/auth/login")
      router.refresh()
    } catch (error) {
      console.error("Logout error", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (shouldHide) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950 text-foreground">
      <Sidebar user={user ?? undefined} onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader
          user={user ?? undefined}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
          onOpenMobileNav={() => setDrawerOpen(true)}
          menuButtonRef={anchorRef}
        />

        <main className="relative flex-1 overflow-x-hidden px-3 pb-10 pt-4 md:px-6 lg:px-8 xl:px-10">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>

      <KnowledgeSidebar />

      <MobileNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} anchorRef={anchorRef} />
    </div>
  )
}
