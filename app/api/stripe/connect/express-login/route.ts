import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * POST /api/stripe/connect/express-login
 * Einmal-URL zum Stripe Express Dashboard (Konto verwalten) – Fallback wenn Embedded nicht läuft.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const expert = await prisma.expert.findUnique({
    where: { userId: session.user.id },
    select: { stripeConnectAccountId: true },
  })

  if (!expert?.stripeConnectAccountId) {
    return NextResponse.json({ error: "Kein Connect-Konto." }, { status: 400 })
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(expert.stripeConnectAccountId)
    return NextResponse.json({ url: loginLink.url })
  } catch (err) {
    console.error("[stripe/connect/express-login] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe-Fehler" },
      { status: 500 }
    )
  }
}
