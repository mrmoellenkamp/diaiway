import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import type Stripe from "stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Stripe Connect Webhook.
 * Takumi-Verifizierung: Sobald Connect-Onboarding (details_submitted) abgeschlossen,
 * setze User.isVerified = true.
 */
export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const webhookSecret =
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret?.trim()) {
    console.error("[Stripe Connect Webhook] No webhook secret configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[Stripe Connect Webhook] Signature verification failed:", msg)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account
      if (account.details_submitted) {
        const expert = await prisma.expert.findFirst({
          where: { stripeConnectAccountId: account.id },
          include: { user: true },
        })
        if (expert?.user) {
          await prisma.$transaction([
            prisma.user.update({
              where: { id: expert.user.id },
              data: {
                isVerified: true,
                verificationSource: "STRIPE_CONNECT",
              },
            }),
            prisma.expert.update({
              where: { id: expert.id },
              data: { verified: true },
            }),
          ])
          console.log(`[Stripe Connect] User ${expert.user.id} verified (Takumi Connect completed)`)
        }
      }
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[Stripe Connect Webhook] Error:", err)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}
