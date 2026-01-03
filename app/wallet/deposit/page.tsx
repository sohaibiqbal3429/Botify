import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { DepositForm } from "@/components/wallet/deposit-form"
import { verifyToken, type JWTPayload } from "@/lib/auth"
import { fetchWalletContext, type WalletContext } from "@/lib/services/wallet"
import {
  ACTIVE_DEPOSIT_THRESHOLD,
  DEPOSIT_L1_PERCENT,
  DEPOSIT_L2_PERCENT,
} from "@/lib/constants/bonuses"
import { Wallet } from "lucide-react"

export const dynamic = "force-dynamic"

/* -------------------- helpers -------------------- */

type DepositWalletOption = {
  id: string
  label: string
  address: string
  network: string
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`

const num = (v: unknown, fallback = 0) => {
  if (v === null || v === undefined) return fallback
  if (typeof v === "number") return v
  const n = Number((v as any).toString?.() ?? v)
  return Number.isFinite(n) ? n : fallback
}

/* -------------------- ENV wallets -------------------- */

function getDepositWalletOptionsFromEnv(): DepositWalletOption[] {
  const wallets = [
    process.env.WALLET_ADDRESS_1,
    process.env.WALLET_ADDRESS_2,
    process.env.WALLET_ADDRESS_3,
  ].filter(Boolean)

  return wallets.map((address, index) => ({
    id: `wallet-${index + 1}`,
    label: `USDT Wallet ${index + 1}`,
    address: address as string,
    network: "USDT (BEP-20)",
  }))
}

/* -------------------- fallback context -------------------- */

function buildFallbackContext(session: JWTPayload): WalletContext {
  return {
    user: {
      name: session.email,
      email: session.email,
      referralCode: session.userId,
      role: session.role,
      profileAvatar: "avatar-01",
      isActive: false,
      depositTotal: 0,
    },
    stats: {
      currentBalance: 0,
      totalBalance: 0,
      totalEarning: 0,
      earningsBalance: 0,
      pendingWithdraw: 0,
      staked: 0,
      walletBalance: 0,
    },
    minDeposit: 50,
    withdrawConfig: {
      minWithdraw: 30,
    },
    withdrawable: {
      amount: 0,
      pendingWithdraw: 0,
    },
  }
}

/* -------------------- page -------------------- */

export default async function DepositPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value

  if (!token) redirect("/auth/login")

  const session = verifyToken(token)
  if (!session) redirect("/auth/login")

  let loadError: string | null = null
  let context: WalletContext | null = null

  try {
    context = await fetchWalletContext(session.userId)
  } catch (err) {
    console.error("Wallet context error:", err)
    loadError = "We couldn't load your wallet details right now."
  }

  if (!context) {
    context = buildFallbackContext(session)
  }

  const walletOptions = getDepositWalletOptionsFromEnv()

  if (walletOptions.length === 0) {
    loadError = loadError ?? "Deposit wallets are not configured."
  }

  const isActive = !!context.user.isActive
  const lifetimeDeposits = num(context.user.depositTotal)
  const threshold = num(ACTIVE_DEPOSIT_THRESHOLD, 80)
  const remainingToActivate = Math.max(0, threshold - lifetimeDeposits)
  const walletBalance = num(context.stats.walletBalance)
  const pendingWithdraw = num(context.stats.pendingWithdraw)
  const minDeposit = num(context.minDeposit)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={context.user} />

      <main className="flex-1 w-full overflow-auto md:ml-64">
        <div className="space-y-6 p-6">

          {loadError && (
            <Alert variant="destructive">
              <AlertTitle>Some data failed to load</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          <header className="flex flex-col gap-2 md:flex-row md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Deposit Funds</h1>
              <p className="text-muted-foreground">
                Transfer USDT to the platform wallets.
              </p>
            </div>

            <div className="text-sm">
              <Badge variant={isActive ? "default" : "outline"}>
                {isActive ? "Active" : "Inactive"}
              </Badge>
              <p className="text-muted-foreground">
                Lifetime deposits: ${lifetimeDeposits.toFixed(2)} / ${threshold.toFixed(2)}
              </p>
              {!isActive && (
                <p className="text-xs text-muted-foreground">
                  Deposit ${remainingToActivate.toFixed(2)} more to activate.
                </p>
              )}
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex justify-between">
                <CardTitle className="text-sm">Wallet Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${walletBalance.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Minimum Deposit</CardTitle>
                <CardDescription>Below this amount is rejected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  ${minDeposit.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pending Withdrawals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  ${pendingWithdraw.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Bonus & Referral</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Father (L1)</p>
                  <p className="text-xl font-semibold">{pct(DEPOSIT_L1_PERCENT)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grandfather (L2)</p>
                  <p className="text-xl font-semibold">{pct(DEPOSIT_L2_PERCENT)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Others</p>
                  <p className="text-xl font-semibold">None</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader>
                <CardTitle>Submit Deposit</CardTitle>
                <CardDescription>
                  Select wallet, send funds, submit transaction hash.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {walletOptions.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Deposit wallets are not configured.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <DepositForm options={walletOptions} minDeposit={minDeposit} />
                )}
              </CardContent>
            </Card>
          </section>

        </div>
      </main>
    </div>
  )
}
