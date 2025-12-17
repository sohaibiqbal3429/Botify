"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { LogOut } from "lucide-react"
import { PRIMARY_NAV_ITEMS, ADMIN_NAV_ITEM } from "@/components/layout/nav-config"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  user?: { name: string; email: string; referralCode: string; role?: string; profileAvatar?: string }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/auth/login")
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <aside className="hidden md:block">
      <div className="h-screen w-[280px] p-4">
        <div className="panel flex h-full flex-col p-3">
          {/* Brand */}
          <div className="flex items-center justify-between px-3 py-2">
            <Link href="/" className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <span className="text-sm font-black tracking-tight">5G</span>
              </div>
              <div className="leading-tight">
                <div className="text-xs text-white/55">Console</div>
                <div className="text-lg font-extrabold">5gBotify</div>
              </div>
            </Link>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60">
              v1
            </span>
          </div>

          {/* Nav */}
          <nav className="mt-3 flex-1 space-y-1 px-1">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={[
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm",
                    "border border-transparent",
                    active
                      ? "bg-white/7 border-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <span className={active ? "text-[hsl(var(--accent))]" : "text-white/60 group-hover:text-white"}>
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold leading-5">{item.name}</div>
                    <div className="truncate text-[11px] text-white/45">{item.description ?? ""}</div>
                  </div>
                </Link>
              )
            })}

            {user?.role === "admin" && (
              <Link
                href={ADMIN_NAV_ITEM.href}
                className={[
                  "group mt-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm",
                  "border border-transparent",
                  pathname === ADMIN_NAV_ITEM.href || pathname.startsWith(`${ADMIN_NAV_ITEM.href}/`)
                    ? "bg-white/7 border-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <span className="text-white/60 group-hover:text-white">
                  <ADMIN_NAV_ITEM.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold leading-5">{ADMIN_NAV_ITEM.name}</div>
                  <div className="truncate text-[11px] text-white/45">Admin controls</div>
                </div>
              </Link>
            )}
          </nav>

          {/* User card */}
          {user && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <Image
                  src={`/avatars/${user.profileAvatar ?? "avatar-01"}.svg`}
                  alt={`${user.name}'s avatar`}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-2xl border border-white/10 bg-white/5"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{user.name}</div>
                  <div className="truncate text-xs text-white/55">{user.email}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="truncate rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/70">
                  {user.referralCode}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleLogout()}
                  className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-white/80 hover:bg-white/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
