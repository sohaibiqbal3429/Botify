"use client"

import { useEffect, useState } from "react"
import { Bell, CheckCheck, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useIsMobile } from "@/components/ui/use-mobile"

interface Notification {
  _id: string
  kind: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    void fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications?limit=10")
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data.notifications) ? data.notifications : []
        setNotifications(list)
        setUnreadCount(list.reduce((acc: number, n: any) => acc + (n?.read ? 0 : 1), 0))
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => (notif._id === notificationId ? { ...notif, read: true } : notif)),
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error)
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (kind: string) => {
    switch (kind) {
      case "referral-joined":
        return "REF"
      case "deposit-approved":
        return "DEP"
      case "withdraw-approved":
        return "WDR"
      case "withdraw-requested":
        return "REQ"
      case "withdraw-cancelled":
        return "CNX"
      case "level-up":
        return "LVL"
      case "cap-reached":
        return "CAP"
      default:
        return "NOTE"
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const renderBellButton = (buttonProps?: React.ComponentProps<typeof Button>) => (
    <Button
      variant="ghost"
      size="icon"
      className="group relative rounded-full bg-card/50 text-foreground shadow-[0_10px_30px_-16px_rgba(109,40,217,0.55)] backdrop-blur"
      aria-label="Open notifications"
      {...buttonProps}
    >
      <span className="absolute inset-0 rounded-full bg-primary/10 opacity-0 transition group-hover:opacity-100" aria-hidden />
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <>
          <span className="absolute inset-0 animate-pulse rounded-full bg-primary/15 blur-[1px]" aria-hidden />
          <span
            className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground shadow-sm ring-2 ring-white/50"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        </>
      )}
    </Button>
  )

  const NotificationsList = () => (
    <div className="space-y-3">
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
      ) : (
        notifications.map((notification) => (
          <div
            key={notification._id}
            className="relative flex items-start gap-3 rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {getNotificationIcon(notification.kind)}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                  <p className="text-xs text-muted-foreground">{notification.body}</p>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {formatTimeAgo(notification.createdAt)}
                </Badge>
              </div>
              {!notification.read && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void markAsRead(notification._id)}>
                  <CheckCheck className="mr-1 h-3.5 w-3.5" />
                  Mark read
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => void markAsRead(notification._id)}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))
      )}
    </div>
  )

  const content = (
    <div className="w-[360px] max-w-[80vw] space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-muted-foreground">Notifications</p>
          <p className="text-xs text-muted-foreground/80">Quick updates, kept compact.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {unreadCount} new
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => void markAllAsRead()} disabled={loading || unreadCount === 0}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-[360px] pr-3">
        <NotificationsList />
      </ScrollArea>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{renderBellButton()}</SheetTrigger>
        <SheetContent side="right" className="w-full max-w-sm">
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{renderBellButton()}</PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-4">
        {content}
      </PopoverContent>
    </Popover>
  )
}
