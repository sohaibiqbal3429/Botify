"use client"

import { TrendingUp, Wallet, DollarSign, ArrowDownToLine, Clock } from "lucide-react"

interface KPICardsProps {
  kpis: {
    totalEarning: number
    totalBalance: number
    currentBalance: number
    activeMembers: number
    totalWithdraw: number
    pendingWithdraw: number
    teamReward: number
    teamRewardToday?: number
  }
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Spark({ level = 3 }: { level?: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex items-end gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 rounded-full ${
            i <= level ? "bg-[hsl(var(--accent))]" : "bg-white/15"
          }`}
          style={{ height: `${6 + i * 3}px` }}
        />
      ))}
    </div>
  )
}

function Tile({
  label,
  value,
  hint,
  Icon,
  level,
  tone,
}: {
  label: string
  value: string
  hint: string
  Icon: any
  level?: 1 | 2 | 3 | 4 | 5
  tone?: "cyan" | "ice" | "rose" | "amber"
}) {
  const toneMap: Record<string, string> = {
    cyan: "ring-[hsl(var(--accent))]/25 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]",
    ice: "ring-[hsl(var(--primary))]/25 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]",
    rose: "ring-rose-400/20 bg-rose-400/10 text-rose-200",
    amber: "ring-amber-300/20 bg-amber-300/10 text-amber-200",
  }

  return (
    <div className="panel soft-hover p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-2xl ring-1 ${toneMap[tone ?? "ice"]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs tracking-wide text-white/60">{label}</div>
            <div className="mt-1 text-xl font-extrabold tracking-tight">{value}</div>
          </div>
        </div>
        <Spark level={level} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-white/55">{hint}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/65">
          Live
        </span>
      </div>
    </div>
  )
}

export function KPICards({ kpis }: KPICardsProps) {
  const tiles = [
    { label: "Total Earnings", value: fmt(kpis.totalEarning), hint: "All-time mining output", Icon: TrendingUp, level: 5, tone: "cyan" as const },
    { label: "Total Balance", value: fmt(kpis.totalBalance), hint: "Wallet + bonuses combined", Icon: Wallet, level: 4, tone: "ice" as const },
    { label: "Current Balance", value: fmt(kpis.currentBalance), hint: "Spendable right now", Icon: DollarSign, level: 3, tone: "cyan" as const },
    { label: "Total Withdraw", value: fmt(kpis.totalWithdraw), hint: "Paid out to date", Icon: ArrowDownToLine, level: 4, tone: "rose" as const },
    { label: "Pending Withdraw", value: fmt(kpis.pendingWithdraw), hint: "In review / processing", Icon: Clock, level: 2, tone: "amber" as const },
  ]

  return (
    <section className="kpi-strip">
      {tiles.map((t) => (
        <div key={t.label} className="col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-3">
          <Tile {...t} />
        </div>
      ))}
    </section>
  )
}
