import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { checkImageSafetyFromBase64 } from "@/lib/vision-safety"
import { setTransactionOnHoldForBooking } from "@/lib/wallet-service"

export const runtime = "nodejs"
export const maxDuration = 15

/**
 * POST /api/safety/snapshot
 * Live-Monitoring: Client sendet Stichproben-Snapshot aus Video-Call.
 * Vision API SafeSearch; merkmalsweise Schwellen (siehe SAFE_SEARCH_CATEGORY_POLICY).
 * Bei Verstoß → Blob + SafetyIncident + Transaktion ON_HOLD.
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

    if (booking.status !== "active") {
      return NextResponse.json(
        { error: "Snapshots nur während aktiver Session." },
        { status: 409 }
      )
    }

    // Vision API prüfen
    const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    if (base64Clean.length > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Bild zu groß." }, { status: 400 })
    }

    const result = await checkImageSafetyFromBase64(base64Clean)

    if (result.safe) {
      return NextResponse.json({ ok: true, safe: true })
    }

    // Verstoß: Blob speichern + SafetyIncident erstellen + Transaktion auf Hold
    const ts = Date.now()
    const filename = `safety-incidents/${bookingId}_${ts}_ALARM.jpg`
    const reason = result.violation
      ? `${result.violation.key}: ${result.violation.level}`
      : result.reason ?? "SafeSearch-Verstoß"

    const buffer = Buffer.from(base64Clean, "base64")
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "image/jpeg",
    })

    await prisma.safetyIncident.create({
      data: {
        bookingId,
        imageUrl: blob.url,
        reason,
      },
    })

    await setTransactionOnHoldForBooking(bookingId)

    // User-Flag für Moderation-Verstoß setzen
    const userIds = [booking.userId, booking.expert?.userId].filter((id): id is string => !!id)
    if (userIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { moderationViolationAt: new Date() },
      })
    }

    console.warn("[Safety] Incident erstellt:", { bookingId, reason, imageUrl: blob.url })

    return NextResponse.json({
      ok: true,
      safe: false,
      incidentCreated: true,
    })
  } catch (err) {
    console.error("[Safety Snapshot] Error:", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Snapshot-Verarbeitung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
