import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * Buchung/Session nur, wenn der Shugyo (Bucher) Phase-2-Einwilligungen abgegeben hat.
 */
export async function assertBookerPaymentVerified(bookerUserId: string): Promise<NextResponse | null> {
  const u = await prisma.user.findUnique({
    where: { id: bookerUserId },
    select: { appRole: true, isPaymentVerified: true },
  })
  if (!u) {
    return NextResponse.json({ error: "Nutzer nicht gefunden.", code: "PAYMENT_ONBOARDING_REQUIRED" }, { status: 404 })
  }
  if (u.appRole !== "shugyo") return null
  if (!u.isPaymentVerified) {
    return NextResponse.json(
      {
        error: "Bitte bestätige zuerst die Zahlungs- und Widerrufshinweise unter Profil oder im angezeigten Dialog.",
        code: "PAYMENT_ONBOARDING_REQUIRED",
      },
      { status: 403 },
    )
  }
  return null
}
