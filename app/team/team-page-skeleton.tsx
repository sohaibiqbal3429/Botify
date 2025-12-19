import { Skeleton } from "@/components/ui/skeleton"

export function TeamPageSkeleton() {
  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 md:flex-row">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.14),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.12),transparent_38%)]" />
      </div>
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-emerald-500/30 md:bg-slate-900/70">
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </aside>
      <main className="relative flex-1 overflow-hidden">
        <div className="space-y-6 p-5 sm:p-6 lg:p-8">
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-600/20 via-slate-900 to-cyan-600/15 p-6 shadow-2xl shadow-emerald-500/20">
            <div className="space-y-2">
              <Skeleton className="h-8 w-60" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Skeleton className="h-10 w-32 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-lg shadow-emerald-500/15">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-10 w-40" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-52" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-6 shadow-lg shadow-emerald-500/15">
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-52" />
                    </div>
                    <div className="flex gap-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
