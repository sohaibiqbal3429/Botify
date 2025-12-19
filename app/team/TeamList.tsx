"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils/formatting"
import { ensureDate, ensureNumber } from "@/lib/utils/safe-parsing"

interface TeamMember {
  _id?: string
  name?: string
  level?: number
  qualified?: boolean
  depositTotal?: number
  referredBy?: string
  createdAt?: string | null
}

interface TeamListResponse {
  items?: TeamMember[] | null
  page?: number
  limit?: number
  total?: number
  hasMore?: boolean
}

interface TeamListProps {
  userId?: string
}

const fetcher = async (url: string) => {
  try {
    const response = await fetch(url, { credentials: "include" })
    const contentType = response.headers.get("content-type") ?? ""
    let payload: unknown = null

    if (contentType.includes("application/json")) {
      try {
        payload = await response.json()
      } catch (parseError) {
        console.error(`Failed to parse team list response from ${url}`, parseError)
      }
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && payload !== null && "error" in payload &&
        typeof (payload as { error?: unknown }).error === "string"
          ? ((payload as { error: string }).error || "Unable to load team members")
          : "Unable to load team members"

      throw new Error(message)
    }

    if (payload && typeof payload === "object") {
      return payload as TeamListResponse
    }

    return { items: [] }
  } catch (error) {
    console.error(`Team list fetch error for ${url}`, error)
    throw error instanceof Error ? error : new Error("Unable to load team members")
  }
}

const PAGE_SIZE = 20

export function TeamList({ userId }: TeamListProps) {
  const [page, setPage] = useState(1)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const key = userId
    ? `/api/team?userId=${encodeURIComponent(userId)}&page=${page}&limit=${PAGE_SIZE}`
    : null

  const { data, error, isLoading, isValidating, mutate } = useSWR<TeamListResponse>(key, fetcher, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    setPage(1)
    setMembers([])
    setTotal(0)
    setHasMore(false)
  }, [userId])

  useEffect(() => {
    if (!data) {
      return
    }

    const rawItems = Array.isArray(data.items) ? data.items : []
    const normalizedItems = rawItems
      .filter((member): member is TeamMember => member !== null && typeof member === "object")
      .map((member, index) => ({
        ...member,
        _id: typeof member._id === "string" && member._id.length > 0 ? member._id : `member-${page}-${index}`,
        createdAt: typeof member.createdAt === "string" ? member.createdAt : null,
      }))

    setMembers((previous) => {
      if (page === 1) {
        return normalizedItems
      }

      const merged = new Map(
        previous.map((member, index) => [member._id ?? `existing-${index}`, member]),
      )

      normalizedItems.forEach((member, index) => {
        const key = member._id ?? `incoming-${page}-${index}`
        merged.set(key, member)
      })

      return Array.from(merged.values())
    })

    setTotal((previousTotal) => {
      if (typeof data.total === "number" && Number.isFinite(data.total)) {
        return data.total
      }

      const baseline = page === 1 ? 0 : previousTotal
      return Math.max(baseline, (page - 1) * PAGE_SIZE + normalizedItems.length)
    })

    setHasMore(() => {
      if (typeof data.hasMore === "boolean") {
        return data.hasMore
      }

      return normalizedItems.length === PAGE_SIZE
    })
  }, [data, page])

  const isInitialLoading = isLoading && members.length === 0
  const isRefreshing = isValidating && members.length > 0

  const summary = useMemo(() => {
    if (total === 0) {
      return "Keep building your network to see referrals here."
    }

    return `Showing ${members.length} of ${total} direct referrals`
  }, [members.length, total])

  if (!userId) {
    return <TeamListSkeleton />
  }

  return (
    <section className="space-y-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/60 p-5 shadow-2xl shadow-emerald-500/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">Orbit roster</p>
          <h2 className="text-2xl font-semibold text-white">Team directory</h2>
          <p className="text-sm text-slate-400">{summary}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="border border-emerald-400/30 bg-emerald-500/15 text-emerald-100 shadow-lg shadow-emerald-500/20 hover:border-emerald-300/60"
          onClick={() => {
            void mutate()
          }}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh list"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isInitialLoading ? (
          <div className="md:col-span-2 xl:col-span-3">
            <TeamListSkeleton />
          </div>
        ) : error ? (
          <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">
            {error.message}
          </div>
        ) : members.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-500/5 p-8 text-center text-sm text-emerald-100">
            No direct referrals yet. Share your referral code to grow your team.
          </div>
        ) : (
          members.map((member, index) => {
            const createdAt = ensureDate(member.createdAt)
            const joinedLabel = createdAt
              ? `Joined ${formatDistanceToNow(createdAt, { addSuffix: true })}`
              : "Joined date unavailable"
            const levelValue = ensureNumber(member.level, Number.NaN)
            const levelLabel = Number.isFinite(levelValue) ? `L${levelValue}` : "N/A"
            const depositTotal = ensureNumber(member.depositTotal, 0)
            const memberId = member._id ?? `member-${index}`
            const idSuffix =
              typeof member._id === "string" && member._id.length >= 6 ? member._id.slice(-6) : "N/A"
            const isQualified = Boolean(member.qualified)

            return (
              <div
                key={memberId}
                className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-emerald-500/10 transition hover:-translate-y-1 hover:border-emerald-400/50"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-cyan-500/5 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                        {levelLabel}
                      </span>
                      <Badge variant={isQualified ? "default" : "secondary"} className="text-[11px]">
                        {isQualified ? "Qualified" : "Not qualified"}
                      </Badge>
                    </div>
                    <p className="text-lg font-semibold text-white">{member.name ?? "Unnamed member"}</p>
                    <p className="text-xs text-slate-400">{joinedLabel}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">ID • {idSuffix}</div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                  <span>Deposited</span>
                  <span className="font-semibold text-emerald-200">{formatCurrency(depositTotal)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {hasMore ? (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            className="border-emerald-400/40 bg-slate-900/60 text-emerald-100 hover:border-emerald-300/70"
            onClick={() => {
              setPage((current) => current + 1)
            }}
            disabled={isValidating && !isInitialLoading}
          >
            {isValidating && !isInitialLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

export function TeamListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-emerald-500/10"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-14 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
