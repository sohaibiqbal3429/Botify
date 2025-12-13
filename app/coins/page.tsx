"use client"


<<<<<<< ours
=======
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { CountdownBadge, CountdownDisplay } from "@/components/launch/countdown-display"
import { useLaunchCountdown } from "@/hooks/use-launch-countdown"
>>>>>>> theirs

import { useState } from "react";
import ComingSoonModal from "./ComingSoonModal";

export default function Page() {
  const [open, setOpen] = useState(false);

  return (
<<<<<<< ours
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
      >
        Open Coming Soon
      </button>

      <ComingSoonModal
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
=======
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/30">

      <main className="flex-1 overflow-auto ">
        <div className="px-6 py-12 lg:px-12">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <Badge
              variant="outline"
              className="mb-6 border-primary/40 bg-primary/5 text-primary transition-colors duration-[var(--t-med)] ease-[var(--ease)]"
            >
              {heroBadgeText}
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Coin Listings &amp; Launchpad
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">{heroDescription}</p>

            <form
              onSubmit={handleJoinWaitlist}
              className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
            >
              <Input
                type="email"
                placeholder="you@example.com"
                className="h-12 rounded-full border-muted bg-background/80 px-5 text-base shadow-sm"
                aria-label="Email address"
              />
              <Button type="submit" className="h-12 rounded-full px-8 text-base font-semibold shadow-lg">
                Notify me
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">No spam—just alpha when we go live.</p>

            <div className="mt-10 w-full">
              <CountdownDisplay segments={segments} phase={phase} />
              {!isReady && <p className="mt-3 text-xs text-muted-foreground">Syncing launch clock with the network…</p>}
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              {LISTINGS.map((listing) => (
                <Card
                  key={listing.name}
                  className="border-muted/60 bg-background/90 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
                >
                  <CardContent className="flex flex-col gap-4 p-6 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                          {listing.stage}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{listing.launch}</span>
                        <CountdownBadge segments={segments} phase={phase} />
                      </div>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight">{listing.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground sm:max-w-md">{listing.description}</p>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                      <span className="text-sm font-medium text-muted-foreground">{listing.interest}</span>
                      {phase === "live" ? (
                        <Button variant="secondary" className="rounded-full px-6">
                          View live market
                        </Button>
                      ) : (
                        <Button variant="secondary" className="rounded-full px-6">
                          Join waitlist
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="h-full border-muted/60 bg-background/90 shadow-sm backdrop-blur">
              <CardContent className="flex h-full flex-col justify-between p-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Stay listing-ready</h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tailor alerts to your strategy—filter by chain, sale stage, or exchange partners, and never miss an
                    allocation window again.
                  </p>
                </div>
                <div className="mt-8 space-y-5">
                  {highlightSet.map((highlight) => (
                    <div
                      key={highlight.title}
                      className="rounded-xl border border-muted/40 bg-background/60 p-4 transition-colors duration-[var(--t-med)] ease-[var(--ease)]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            {highlight.title}
                          </h3>
                          <p className="mt-2 text-sm text-muted-foreground/80">{highlight.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-semibold text-primary">{highlight.stat}</span>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{highlight.helper}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-muted/40 bg-background/60 p-4 transition-colors duration-[var(--t-med)] ease-[var(--ease)]">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mining Economics</h3>
                    <div className="mt-4 space-y-4">
                      {ECONOMICS_RULES.map((rule) => (
                        <div
                          key={rule.label}
                          className="flex items-start justify-between gap-4 rounded-lg bg-background/70 p-3 shadow-sm shadow-black/5"
                        >
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">{rule.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground/80">
                              {snapshotKey === "live" ? rule.live : rule.scheduled}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-primary">{rule.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 space-y-3">
                      {progressSnapshot.map((progress) => (
                        <div key={progress.label}>
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                            <span>{progress.label}</span>
                            <span>{progress.value}%</span>
                          </div>
                          <Progress value={progress.value} className="mt-2 h-2 overflow-hidden">
                            <span className="sr-only">{progress.label}</span>
                          </Progress>
                          <p className="mt-1 text-xs text-muted-foreground">{progress.helper}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
>>>>>>> theirs
}
