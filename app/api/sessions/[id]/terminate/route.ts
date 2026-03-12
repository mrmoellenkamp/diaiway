import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { terminateSessionForBooking } from "@/lib/session-terminate"

export const runtime = "nodejs"

/**
 * POST /api/sessions/[id]/terminate
 * Secure session termination and payment finalization.
 *
 * Business rules:
 * - Duration < 5 min (Handshake): Release payment hold (Stripe cancel / Wallet refund).
 * - Duration >= 5 min: Capture payment and complete session.
 *
 * Idempotent: Returns current status if already terminated.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id: bookingId } = await params

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })

  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }

  const uid = session.user.id
  const isShugyo = booking.userId === uid
  const isTakumi = booking.expert?.userId === uid
  if (!isShugyo && !isTakumi) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }

  const result = await terminateSessionForBooking(bookingId)

  if (!result.ok) {
    if (result.error?.includes("nur aus Status")) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    durationMs: result.durationMs,
    message:
      result.status === "cancelled_in_handshake"
        ? "Handshake beendet. Zahlung wurde freigegeben."
        : "Session abgeschlossen. Zahlung wurde eingezogen.",
  })
}
