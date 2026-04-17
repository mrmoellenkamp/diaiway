import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { assertCronAuthorized } from "@/lib/cron-auth"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MIN_PAYOUT_CENTS = 500 // Mindestbetrag: 5 €

/**
 * GET /api/cron/payout-takumis
 * Täglicher Cron: Zahlt Takumi-Guthaben (aus Instant Calls / Wallet-Zahlungen)
 * via Stripe Connect Transfer aus.
 *
 * Nur für Takumis mit aktivem Stripe Connect Konto und Guthaben >= 5 €.
 * Geplante Calls mit Stripe Connect werden direkt von Stripe ausgezahlt (kein Eintrag hier).
 */
export async function GET(req: Request) {
  const authErr = assertCronAuthorized(req, "payout-takumis")
  if (authErr) return authErr

  const experts = await prisma.expert.findMany({
    where: {
      stripeConnectAccountId: { not: null },
      stripeConnectStatus: "active",
      user: { balance: { gte: MIN_PAYOUT_CENTS } },
    },
    select: {
      id: true,
      stripeConnectAccountId: true,
      user: { select: { id: true, balance: true, name: true } },
    },
  })

  const results: { expertId: string; ok: boolean; amountCents?: number; error?: string }[] = []

  for (const expert of experts) {
    if (!expert.user || !expert.stripeConnectAccountId) continue
    const amountCents = expert.user.balance

    try {
      // Stripe Transfer: Guthaben auf Connect-Konto des Takumis übertragen
      await stripe.transfers.create({
        amount: amountCents,
        currency: "eur",
        destination: expert.stripeConnectAccountId,
        description: `diAiway Auszahlung – ${expert.user.name}`,
        metadata: { expertId: expert.id, userId: expert.user.id },
      })

      // Guthaben in DB auf 0 setzen
      await prisma.user.update({
        where: { id: expert.user.id },
        data: { balance: 0 },
      })

      results.push({ expertId: expert.id, ok: true, amountCents })
      console.log(`[payout-takumis] ${expert.user.name}: ${amountCents / 100} € ausgezahlt`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe-Fehler"
      logSecureError("cron.payout-takumis.item", err, { expertId: expert.id })
      results.push({ expertId: expert.id, ok: false, error: msg })
    }
  }

  const succeeded = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  console.log(`[payout-takumis] Abgeschlossen: ${succeeded} erfolgreich, ${failed} fehlgeschlagen`)

  return NextResponse.json({ ok: true, processed: results.length, succeeded, failed, results })
}
