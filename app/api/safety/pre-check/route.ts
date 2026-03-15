import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkImageSafetyFromBase64 } from "@/lib/vision-safety"

export const runtime = "nodejs"
export const maxDuration = 15

/**
 * POST /api/safety/pre-check
 * Pre-Join Gate: Vision-API-Prüfung vor Daily-Beitritt (Blitzlicht bei 0s).
 * Kein status-active-Check – Session ist noch nicht gestartet.
 * Erstellt KEIN SafetyIncident, nur Vision-API-Check.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { bookingId, imageBase64 } = body as { bookingId?: string; imageBase64?: string }

    if (!bookingId || !imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "bookingId und imageBase64 erforderlich." }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { expert: { select: { userId: true } } },
    })

    if (!booking) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
    }

    const uid = session.user.id
    const isBooker = booking.userId === uid
    const isExpert = booking.expert?.userId === uid

    if (!isBooker && !isExpert) {
      return NextResponse.json({ error: "Keine Berechtigung für diese Buchung." }, { status: 403 })
    }

    const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    if (base64Clean.length > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Bild zu groß." }, { status: 400 })
    }

    const result = await checkImageSafetyFromBase64(base64Clean)

    if (result.safe) {
      return NextResponse.json({ ok: true, safe: true })
    }

    return NextResponse.json({
      ok: true,
      safe: false,
      reason: result.reason ?? "Bild enthält möglicherweise ungeeignete Inhalte.",
    })
  } catch (err) {
    console.error("[Safety Pre-Check] Error:", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Prüfung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
