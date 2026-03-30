import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/stripe/connect/status
 * Gibt den aktuellen Stripe Connect Status des eingeloggten Takumis zurück.
 * Synchronisiert den Status mit Stripe falls ein Account vorhanden ist.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const expert = await prisma.expert.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectStatus: true,
      stripeConnectOnboardedAt: true,
    },
  })

  if (!expert) {
    return NextResponse.json({ error: "Kein Takumi-Profil gefunden." }, { status: 404 })
  }

  if (!expert.stripeConnectAccountId) {
    return NextResponse.json({ status: "not_connected", accountId: null })
  }

  try {
    // Aktuellen Status direkt von Stripe holen
    const account = await stripe.accounts.retrieve(expert.stripeConnectAccountId)

    const isActive =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted

    const newStatus = isActive
      ? "active"
      : account.details_submitted
        ? "restricted"
        : "pending"

    // DB synchronisieren falls Status sich geändert hat
    if (newStatus !== expert.stripeConnectStatus) {
      await prisma.expert.update({
        where: { id: expert.id },
        data: {
          stripeConnectStatus: newStatus,
          ...(isActive && !expert.stripeConnectOnboardedAt
            ? { stripeConnectOnboardedAt: new Date() }
            : {}),
        },
      })
    }

    return NextResponse.json({
      status: newStatus,
      accountId: expert.stripeConnectAccountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      onboardedAt: expert.stripeConnectOnboardedAt,
    })
  } catch (err) {
    console.error("[stripe/connect/status] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe-Fehler" },
      { status: 500 }
    )
  }
}
