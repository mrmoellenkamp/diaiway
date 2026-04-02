import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { checkImageSafetyFromBase64 } from "@/lib/vision-safety"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 15

/**
 * POST /api/guest/snapshot
 *
 * Blitzlicht-Protokoll (Safety Snapshot) für Gast-Calls.
 * Authenticated via guestToken (no NextAuth session required).
 *
 * Timing is enforced by the client (5s, 30s, 60s, 90s, 120s after call start).
 * Body: { guestToken, imageBase64 }
 *
 * On violation: Blob + SafetyIncident + moderationViolationAt on expert user.
 * Returns: { ok, safe, incidentCreated? }
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`guest-snapshot:${ip}`, { limit: 30, windowSec: 3600 })
  if (!rl.success) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { guestToken, imageBase64 } = body as { guestToken?: string; imageBase64?: string }

    if (!guestToken || !imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "guestToken und imageBase64 erforderlich." }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { guestToken },
      include: { expert: { select: { userId: true } } },
    })

    if (!booking || !booking.isGuestCall) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
    }
    if (booking.paymentStatus !== "paid") {
      return NextResponse.json({ error: "Zahlung nicht bestätigt." }, { status: 403 })
    }
    if (booking.status !== "active") {
      // Allow snapshots even for "confirmed" guest calls (status may not be updated yet)
      // Only block for explicitly ended/cancelled sessions
      if (["completed", "cancelled", "declined"].includes(booking.status)) {
        return NextResponse.json({ error: "Session bereits beendet." }, { status: 409 })
      }
    }

    // Validate and clean base64
    const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    if (base64Clean.length > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Bild zu groß (max. 4 MB)." }, { status: 400 })
    }

    // Vision API safety check
    const result = await checkImageSafetyFromBase64(base64Clean)

    if (result.safe) {
      return NextResponse.json({ ok: true, safe: true })
    }

    // Violation: store blob + create SafetyIncident
    const ts = Date.now()
    const filename = `safety-incidents/${booking.id}_${ts}_GUEST_ALARM.jpg`
    const reason = result.violation
      ? `${result.violation.key}: ${result.violation.level}`
      : result.reason ?? "SafeSearch-Verstoß (Gast-Call)"

    const buffer = Buffer.from(base64Clean, "base64")
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "image/jpeg",
    })

    await prisma.safetyIncident.create({
      data: {
        bookingId: booking.id,
        imageUrl: blob.url,
        reason,
      },
    })

    // Flag expert user for moderation (guest has no account at this point)
    if (booking.expert?.userId) {
      await prisma.user.update({
        where: { id: booking.expert.userId },
        data: { moderationViolationAt: new Date() },
      })
    }

    console.warn("[Safety/Guest] Incident erstellt:", { bookingId: booking.id, reason, imageUrl: blob.url })

    return NextResponse.json({ ok: true, safe: false, incidentCreated: true })
  } catch (err) {
    console.error("[Safety/Guest Snapshot] Error:", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Snapshot-Verarbeitung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
