import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkImageSafetyFromBase64 } from "@/lib/vision-safety"

export const runtime = "nodejs"

/**
 * POST /api/safety/pre-check
 * Shugyo sendet ein Base64-Screenshot vor dem Daily-Join.
 * Bei "Safe" darf er beitreten (Lobby → sichtbar).
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { bookingId, imageBase64 } = body as { bookingId?: string; imageBase64?: string }
    if (!bookingId || !imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "bookingId und imageBase64 erforderlich." }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { expert: true },
    })
    if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

    const uid = session.user.id
    const isBooker = booking.userId === uid
    const isExpert = booking.expert?.userId === uid
    if (!isBooker && !isExpert) {
      return NextResponse.json({ error: "Kein Zugriff auf diese Buchung." }, { status: 403 })
    }

    if (booking.status !== "confirmed" && booking.status !== "active") {
      return NextResponse.json({ error: "Pre-Check nur bei bestätigter oder aktiver Buchung." }, { status: 400 })
    }

    // Nur Shugyo durchläuft den Pre-Check (wir scannen seinen Stream)
    if (!isBooker) {
      return NextResponse.json({ safe: true, skip: true }) // Takumi braucht keinen Pre-Check
    }

    if (booking.callType === "VOICE") {
      return NextResponse.json({ safe: true, skip: true }) // Kein Video → kein Scan
    }

    const result = await checkImageSafetyFromBase64(imageBase64)
    return NextResponse.json({ safe: result.safe, reason: result.reason })
  } catch (err) {
    console.error("[Safety Pre-Check]", err)
    return NextResponse.json({ error: "Fehler beim Pre-Check." }, { status: 500 })
  }
}
