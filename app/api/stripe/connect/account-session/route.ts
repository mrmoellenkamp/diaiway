import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * POST /api/stripe/connect/account-session
 * Erstellt eine kurzlebige Stripe Account Session für Embedded Components.
 * Wird vom Frontend benötigt, um das eingebettete Onboarding-Formular zu laden.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const expert = await prisma.expert.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      email: true,
      stripeConnectAccountId: true,
    },
  })

  if (!expert) {
    return NextResponse.json({ error: "Kein Takumi-Profil gefunden." }, { status: 404 })
  }

  try {
    let accountId = expert.stripeConnectAccountId

    // Konto erstellen falls noch keins vorhanden
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "DE",
        email: expert.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        settings: {
          payouts: {
            schedule: { interval: "weekly", weekly_anchor: "monday" },
          },
        },
        metadata: {
          expertId: expert.id,
          userId: session.user.id,
        },
      })
      accountId = account.id

      await prisma.expert.update({
        where: { id: expert.id },
        data: {
          stripeConnectAccountId: accountId,
          stripeConnectStatus: "pending",
        },
      })
    }

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
        notification_banner: { enabled: true },
      },
    })

    return NextResponse.json({
      clientSecret: accountSession.client_secret,
      accountId,
    })
  } catch (err) {
    console.error("[stripe/connect/account-session] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe-Fehler" },
      { status: 500 }
    )
  }
}
