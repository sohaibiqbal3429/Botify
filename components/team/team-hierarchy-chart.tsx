
"use client"

import { memo, useMemo } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface TeamHierarchyMember {
  _id?: string
  name?: string | null
  email?: string | null
  referralCode?: string | null
  level?: number | null
  depositTotal?: number | null
  isActive?: boolean | null
  qualified?: boolean | null
  createdAt?: string | null
  profileAvatar?: string | null
  children?: TeamHierarchyMember[] | null
  directCount?: number | null
  activeCount?: number | null
}

interface TeamStatsSummary {
  totalMembers?: number | null
  activeMembers?: number | null
  directReferrals?: number | null
  directActive?: number | null
  totalTeamDeposits?: number | null
  totalTeamEarnings?: number | null
  levels?: { level1?: number | null; level2?: number | null } | null
}

interface TeamHierarchyChartProps {
  teamTree: TeamHierarchyMember
  teamStats?: TeamStatsSummary | null
  maxDepth?: number
}

const LEVEL_STYLES = [
  {
    card: "from-emerald-500/20 via-emerald-500/10 to-slate-900 border-emerald-500/50",
    avatar: "ring-emerald-400/60 bg-emerald-500/10 text-emerald-50",
    badge: "bg-emerald-500/10 text-emerald-50",
  },
  {
    card: "from-cyan-500/20 via-cyan-500/10 to-slate-900 border-cyan-400/50",
    avatar: "ring-cyan-400/60 bg-cyan-500/10 text-cyan-50",
    badge: "bg-cyan-500/10 text-cyan-50",
  },
  {
    card: "from-amber-400/25 via-amber-500/10 to-slate-900 border-amber-400/60",
    avatar: "ring-amber-300/60 bg-amber-400/10 text-amber-50",
    badge: "bg-amber-400/10 text-amber-50",
  },
  {
    card: "from-sky-400/25 via-sky-500/10 to-slate-900 border-sky-400/50",
    avatar: "ring-sky-300/60 bg-sky-400/10 text-sky-50",
    badge: "bg-sky-400/10 text-sky-50",
  },
] as const

function getInitials(name?: string | null, email?: string | null) {
  const source = name && name.trim().length > 0 ? name : email ?? "Member"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "TM"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—"
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getRoleLabel(depth: number) {
  if (depth === 0) return "Team Leader"
  if (depth === 1) return "Level 1 Referral"
  if (depth === 2) return "Level 2 Referral"
  return `Level ${depth} Member`
}

function getProgressLabel(member: TeamHierarchyMember) {
  if (member.qualified) return "Qualified"
  if (member.isActive) return "Active"
  return "Progressing"
}

interface MemberNodeProps {
  member: TeamHierarchyMember
  depth: number
  maxDepth: number
}

const MemberNode = memo(function MemberNode({ member, depth, maxDepth }: MemberNodeProps) {
  if (!member || depth >= maxDepth) {
    return null
  }

  const styles = LEVEL_STYLES[depth % LEVEL_STYLES.length]
  const levelValue = typeof member.level === "number" && Number.isFinite(member.level) ? member.level : null
  const directCount = typeof member.directCount === "number" ? member.directCount : 0
  const activeCount = typeof member.activeCount === "number" ? member.activeCount : 0
  const progressionLabel = getProgressLabel(member)

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "relative flex w-full max-w-xs flex-col items-center gap-4 overflow-hidden rounded-2xl border p-6 text-sm shadow-xl shadow-emerald-500/20",
          "bg-gradient-to-br",
          styles.card,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.08),transparent_40%)]" />

        <Avatar
          className={cn(
            "h-16 w-16 border-4 border-slate-900 shadow-xl",
            "ring-4",
            styles.avatar,
          )}
        >
          {member.profileAvatar ? (
            <AvatarImage src={member.profileAvatar} alt={member.name ?? member.email ?? "Team member"} />
          ) : null}
          <AvatarFallback className="text-base font-semibold uppercase">
            {getInitials(member.name, member.email)}
          </AvatarFallback>
        </Avatar>

        <div className="relative space-y-1">
          <h3 className="text-base font-semibold text-white">{member.name ?? "Unnamed member"}</h3>
          <p className="text-xs text-slate-300">{member.email ?? "Email unavailable"}</p>
        </div>

        <div className="relative flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary" className={cn("border-none", styles.badge)}>
            {getRoleLabel(depth)}
          </Badge>
          {levelValue !== null ? (
            <Badge variant="outline" className="border-white/30 text-white">
              Level {levelValue}
            </Badge>
          ) : null}
          <Badge
            variant={member.qualified ? "default" : member.isActive ? "outline" : "secondary"}
            className={cn(
              member.qualified
                ? "bg-emerald-500/20 text-emerald-50"
                : member.isActive
                  ? "border-amber-300/60 text-amber-100"
                  : "bg-slate-800 text-slate-300",
            )}
          >
            {progressionLabel}
          </Badge>
        </div>

        <div className="relative grid w-full grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <p className="text-slate-400">Team deposits</p>
            <p className="font-semibold text-white">{formatCurrency(member.depositTotal ?? null)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <p className="text-slate-400">Direct referrals</p>
            <p className="font-semibold text-white">{directCount}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <p className="text-slate-400">Active referrals</p>
            <p className="font-semibold text-emerald-200">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <p className="text-slate-400">Joined</p>
            <p className="font-semibold text-white">{formatDate(member.createdAt)}</p>
          </div>
        </div>

        {member.referralCode ? (
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Code: <span className="text-foreground">{member.referralCode}</span>
          </p>
        ) : null}
      </div>

      {member.children && member.children.length > 0 ? (
        <div className="relative mt-8 w-full">
          <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 -translate-y-6 bg-emerald-400/60" />
          <div className="relative flex flex-wrap justify-center gap-6 pt-6">
            <div className="pointer-events-none absolute left-[10%] right-[10%] top-0 hidden h-px bg-emerald-400/60 md:block" />
            {member.children.map((child) => (
              <div key={child._id ?? `${member._id}-child`} className="relative">
                <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 -translate-y-6 bg-emerald-400/60" />
                <MemberNode member={child} depth={depth + 1} maxDepth={maxDepth} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
})

MemberNode.displayName = "MemberNode"

export function TeamHierarchyChart({ teamTree, teamStats, maxDepth = 4 }: TeamHierarchyChartProps) {
  const flattenedLevels = useMemo(() => {
    const levels: number[] = []

    function traverse(node: TeamHierarchyMember | null, depth: number) {
      if (!node || depth >= maxDepth) {
        return
      }

      levels[depth] = (levels[depth] ?? 0) + 1

      if (Array.isArray(node.children)) {
        node.children.forEach((child) => traverse(child, depth + 1))
      }
    }

    traverse(teamTree, 0)
    return levels
  }, [teamTree, maxDepth])

  const totalMembers = teamStats?.totalMembers ?? flattenedLevels.reduce((acc, count) => acc + count, 0)
  const activeMembers = teamStats?.activeMembers ?? undefined

  return (
    <Card className="overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 shadow-2xl shadow-emerald-500/15">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.12),transparent_40%)]" />
      <CardHeader className="relative space-y-2">
        <CardTitle className="text-xl font-semibold text-white">Team hierarchy</CardTitle>
        <p className="text-sm text-slate-300">
          Visualize how your team is structured and track how members progress across levels.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Badge variant="secondary" className="border border-emerald-400/40 bg-emerald-500/15 text-emerald-50">
            Levels visible: {flattenedLevels.length}
          </Badge>
          <Badge variant="secondary" className="border border-cyan-400/40 bg-cyan-500/15 text-cyan-50">
            Members mapped: {totalMembers}
          </Badge>
          {typeof activeMembers === "number" ? (
            <Badge variant="secondary" className="border border-amber-300/50 bg-amber-400/15 text-amber-50">
              Active: {activeMembers}
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="flex flex-col items-center gap-12">
          <MemberNode member={teamTree} depth={0} maxDepth={maxDepth} />
        </div>
      </CardContent>
    </Card>
  )
}

export function TeamHierarchySkeleton() {
  return (
    <Card className="border border-emerald-500/30 bg-slate-900/80">
      <CardHeader className="space-y-3">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-4 w-72 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-10">
          <HierarchyNodeSkeleton />
        </div>
      </CardContent>
    </Card>
  )
}

function HierarchyNodeSkeleton({ depth = 0, maxDepth = 3 }: { depth?: number; maxDepth?: number }) {
  if (depth >= maxDepth) return null

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-dashed border-emerald-500/30 bg-slate-900/70 p-6 shadow-lg shadow-emerald-500/15">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-44" />
        <div className="grid w-full grid-cols-2 gap-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-6">
        <HierarchyNodeSkeleton depth={depth + 1} maxDepth={maxDepth} />
        <HierarchyNodeSkeleton depth={depth + 1} maxDepth={maxDepth} />
      </div>
    </div>
  )
}
