import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Suspense } from "react"

const FAQS = [
  {
    title: "1. What is 5gBotify?",
    body:
      "5gBotify is a digital rewards platform that allows users to earn daily profits through secure and automated payout cycles. It is designed for both beginners and professionals to grow their digital income safely.",
  },
  {
    title: "2. How do I start earning on 5gBotify?",
    body:
      "Create an account, verify your email, and choose a rewards plan. Once you make a deposit, your rewards process will begin automatically and you will start earning daily rewards.",
  },
  {
    title: "3. What is the minimum deposit amount?",
    body:
      "The minimum deposit is 50 USDT. Deposits below this amount are not accepted. Higher deposits unlock better earning opportunities and bonuses.",
  },
  {
    title: "4. How long does it take for deposits to reflect?",
    body: "Deposits usually reflect within 1–5 minutes after network confirmation. If there is a delay, contact support.",
  },
  {
    title: "5. Are rewards guaranteed every day?",
    body:
      "Rewards depend on platform policies and performance. Daily payouts may vary. You can track rewards in your dashboard and transaction history.",
  },
  {
    title: "6. Is there a fee for withdrawals?",
    body:
      "Standard network fees apply. Review the fee estimate shown in the withdrawal form before submitting your request.",
  },
  {
    title: "7. What happens if I miss a day?",
    body:
      "Missing a day simply means you will not receive that day’s reward. You can continue earning by returning to the platform and completing the available missions.",
  },
  {
    title: "8. Is there a referral program?",
    body:
      "Yes. Share your referral code to earn additional rewards when your invited friends participate on the platform.",
  },
  {
    title: "9. Can I upgrade my rewards plan later?",
    body: "Yes. Upgrading increases your daily profit percentage and overall rewards performance.",
  },
  {
    title: "10. Is my data secure?",
    body:
      "We use encryption, secure authentication, and routine audits to protect your data. Always keep your credentials private and enable available security options.",
  },
  {
    title: "11. Which currencies and networks are supported?",
    body:
      "5gBotify supports USDT (BEP-20) and other popular wallets. You can deposit and withdraw funds using these methods easily.",
  },
  {
    title: "12. How do I contact support?",
    body:
      'If you encounter any issues, contact the 5gBotify support team through the "Help" or "Contact Us" section in your dashboard for quick assistance.',
  },
]

function TermsContent() {
  return (
    <div className="flex min-h-screen bg-background">
    <main className="mx-auto flex w-full flex-col gap-6 px-4 py-10">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-500">Knowledge base</p>
          <h1 className="text-3xl font-semibold">Terms & FAQs</h1>
          <p className="text-sm text-muted-foreground">
            Learn how rewards, deposits, withdrawals, and referrals work across the 5gBotify platform.
          </p>
        </header>

        <div className="grid gap-4">
          {FAQS.map((faq) => (
            <Card key={faq.title} className="border-slate-200 bg-card shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-semibold">{faq.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{faq.body}</CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-card/60 p-6 shadow-sm dark:border-slate-800">
          <h2 className="text-lg font-semibold">Need more help?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Email: support@5gbotify.com — our team is available to assist with account, payout, and policy questions.
          </p>
        </div>
      </main>
    </div>
  )
}

export default function TermsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <TermsContent />
    </Suspense>
  )
}
