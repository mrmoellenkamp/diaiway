import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { put } from "@vercel/blob"
import { checkImageSafetyFromBase64 } from "@/lib/vision-safety"

export const runtime = "nodejs"

/**
 * POST /api/safety/alert-snapshot
 * Während des Calls: Shugyo sendet zufällige Snapshot.
 * Wenn LIKELY+ → speichere in Vercel Blob + SafetyIncident für Beweissicherung.
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
    if (!isBooker) {
      return NextResponse.json({ error: "Nur der Shugyo kann Snapshots senden." }, { status: 403 })
    }

    if (booking.status !== "active") {
      return NextResponse.json({ error: "Snapshot nur während aktiver Session." }, { status: 400 })
    }

    if (!booking.snapshotConsentAt) {
      return NextResponse.json({ error: "Keine Einwilligung für Snapshots." }, { status: 400 })
    }

    const result = await checkImageSafetyFromBase64(imageBase64)
    if (result.safe) {
      return NextResponse.json({ safe: true, saved: false })
    }

    // Verstoß (LIKELY oder VERY_LIKELY) → speichern
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)
    const filename = `safety/${bookingId}_${timestamp}_ALARM.jpg`

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "image/jpeg",
    })

    await prisma.safetyIncident.create({
      data: {
        bookingId,
        imageUrl: blob.url,
        reason: result.violation ? `${result.violation.key}: ${result.violation.level}` : result.reason || "Verstoß erkannt",
      },
    })

    return NextResponse.json({ safe: false, saved: true, reason: result.reason })
  } catch (err) {
    console.error("[Safety Alert Snapshot]", err)
    return NextResponse.json({ error: "Fehler beim Speichern." }, { status: 500 })
  }
}
