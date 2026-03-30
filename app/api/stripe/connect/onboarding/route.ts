import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * POST /api/stripe/connect/onboarding
 * Erstellt ein Stripe Connect Express Konto für den Takumi (falls noch keins vorhanden)
 * und gibt einen Onboarding-Link zurück.
 */
export async function POST(req: Request) {
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
      stripeConnectStatus: true,
    },
  })

  if (!expert) {
    return NextResponse.json({ error: "Kein Takumi-Profil gefunden." }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const returnUrl = (body?.returnUrl as string) || `${process.env.NEXTAUTH_URL}/profile/finances`
  const refreshUrl = (body?.refreshUrl as string) || `${process.env.NEXTAUTH_URL}/profile/finances?connect=refresh`

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
            schedule: { interval: "daily" },
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

    // Onboarding-Link generieren
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url, accountId })
  } catch (err) {
    console.error("[stripe/connect/onboarding] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe-Fehler" },
      { status: 500 }
    )
  }
}
