"use client"

import Link from "next/link"
import { BookOpenText, ChevronLeft, Sparkles } from "lucide-react"
import { useState } from "react"

import { KNOWLEDGE_BASE_NAV } from "@/components/layout/nav-config"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function KnowledgeSidebar() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-l border-slate-800/70 bg-slate-950/70 backdrop-blur xl:flex",
        isOpen ? "w-72" : "w-[4.5rem]",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      aria-label="Knowledge base navigation"
    >
      <div className="flex h-full flex-col gap-4 px-3 py-4">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden />
            {isOpen && <span className="font-semibold">Knowledge Base</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg border border-slate-800/80 bg-slate-900/70 text-slate-300 hover:text-white"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? "Collapse knowledge base" : "Expand knowledge base"}
          >
            <ChevronLeft className={cn("h-4 w-4 transition", isOpen ? "" : "rotate-180")}
              aria-hidden />
          </Button>
        </div>

        <div
          className={cn(
            "flex-1 space-y-4 rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-900/70 via-slate-900/40 to-slate-950/40 p-4",
            "shadow-[0_20px_60px_-28px_rgba(0,0,0,0.7)]",
          )}
        >
          <div className="flex items-start gap-3 text-sm text-slate-200">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200 shadow-inner shadow-cyan-500/20">
              <BookOpenText className="h-5 w-5" aria-hidden />
            </div>
            {isOpen && (
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">Documentation</p>
                <p className="text-xs text-slate-300">
                  Explore platform guides, FAQs, and troubleshooting without leaving your current flow.
                </p>
              </div>
            )}
          </div>

          <Separator className="border-slate-800/70" />

          <Link
            href={KNOWLEDGE_BASE_NAV.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-sm font-semibold text-cyan-100",
              "transition hover:border-cyan-400/60 hover:bg-cyan-500/15 hover:text-white",
            )}
            prefetch
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-600/20 text-cyan-200 group-hover:text-white">
              <KNOWLEDGE_BASE_NAV.icon className="h-4 w-4" aria-hidden />
            </div>
            {isOpen && (
              <div className="flex flex-col leading-tight">
                <span>{KNOWLEDGE_BASE_NAV.name}</span>
                <span className="text-[11px] font-normal uppercase tracking-wide text-cyan-100/80">Always-on guidance</span>
              </div>
            )}
          </Link>

          {isOpen && (
            <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-3 text-xs text-slate-300">
              <p className="font-semibold text-white">Need more help?</p>
              <p className="mt-1 leading-relaxed text-slate-300/90">
                Access tailored tutorials, mining calculators, and compliance notes while keeping your current context intact.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
