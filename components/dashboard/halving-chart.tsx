"use client"

import { Card, CardContent } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const halvingData = [
  { userScale: "1K", performance: 10 },
  { userScale: "10K", performance: 5 },
  { userScale: "100K", performance: 2.5 },
  { userScale: "1M", performance: 1.25 },
  { userScale: "10M", performance: 0.625 },
  { userScale: ">10M", performance: 0.3125 },
]

export function HalvingChart() {
  return (
    <div className="panel p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold tracking-wide text-white/70">Network Rule</div>
          <h3 className="mt-1 text-2xl font-extrabold tracking-tight">Halving Protocol</h3>
          <p className="mt-1 text-sm text-white/55">
            Output factor reduces as the userbase scales (10× growth steps).
          </p>
        </div>

        <div className="flex gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">50% step</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">Auto-adjust</span>
        </div>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={halvingData} margin={{ top: 14, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 6" opacity={0.18} />
            <XAxis dataKey="userScale" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "rgba(255,255,255,.60)" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "rgba(255,255,255,.55)" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(9,16,34,.92)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 14,
                color: "rgba(255,255,255,.85)",
              }}
              labelStyle={{ color: "rgba(255,255,255,.8)" }}
            />
            <defs>
              <linearGradient id="botifyBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.95} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <Bar dataKey="performance" fill="url(#botifyBar)" radius={[10, 10, 10, 10]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/55">Rule</div>
          <div className="mt-1 text-sm font-semibold">10× users → 50% factor</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/55">Impact</div>
          <div className="mt-1 text-sm font-semibold">Stabilizes emission rate</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/55">Hint</div>
          <div className="mt-1 text-sm font-semibold">Early users get higher factor</div>
        </div>
      </div>
    </div>
  )
}
