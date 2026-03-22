import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getClientIp } from "@/lib/rate-limit"
import { hashRegistrationIp } from "@/lib/registration-ip-hash"

export const runtime = "nodejs"

type Body = {
  billingPaymentConsent?: boolean
  withdrawalWaiver?: boolean
}

/**
 * POST — Phase 2: Shugyo bestätigt Zahlungsweitergabe + Widerrufsverzicht (just-in-time).
 * Rechnungsdaten selbst werden weiterhin nur über PATCH /api/user/profile an unser Backend gesendet;
 * Stripe erhält Zahlungsmittel erst beim Checkout/Wallet gemäß eurem Payment-Flow.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const ip = getClientIp(req)
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 })
  }

  if (body.billingPaymentConsent !== true || body.withdrawalWaiver !== true) {
    return NextResponse.json(
      { error: "Beide Zustimmungen sind erforderlich.", code: "CONSENT_INCOMPLETE" },
      { status: 400 },
    )
  }

  const userId = session.user.id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { appRole: true },
  })
  if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })
  if (user.appRole !== "shugyo") {
    return NextResponse.json({ error: "Nur für Shugyo erforderlich." }, { status: 403 })
  }

  const now = new Date()
  const ipHashBilling = hashRegistrationIp(ip)
  const ipHashWaiver = hashRegistrationIp(`${ip}:withdrawal`)

  await prisma.user.update({
    where: { id: userId },
    data: {
      isPaymentVerified: true,
      phase2BillingConsentAt: now,
      phase2BillingConsentIpHash: ipHashBilling,
      phase2WithdrawalWaiverAt: now,
      phase2WithdrawalWaiverIpHash: ipHashWaiver,
      paymentProcessorConsentAt: now,
      earlyPerformanceWaiverAt: now,
    },
  })

  return NextResponse.json({ success: true, isPaymentVerified: true })
}
