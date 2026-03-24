import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * PATCH /api/admin/bookings/[bookingId]/booker-rating
 * Takumi-Bewertung des Shugyo (expertRating / expertReviewText) für eine Buchung.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { bookingId } = await params
  const body = await req.json().catch(() => ({}))
  const { expertRating, expertReviewText } = body as {
    expertRating?: unknown
    expertReviewText?: unknown
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true },
  })
  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }

  const data: { expertRating?: number | null; expertReviewText?: string } = {}

  if (expertRating !== undefined) {
    if (expertRating === null || expertRating === "") {
      data.expertRating = null
    } else {
      const r = Math.min(5, Math.max(1, Number(expertRating) || 0))
      if (r < 1) {
        return NextResponse.json({ error: "Sterne müssen zwischen 1 und 5 liegen (oder leer zum Entfernen)." }, { status: 400 })
      }
      data.expertRating = r
    }
  }

  if (expertReviewText !== undefined) {
    data.expertReviewText =
      typeof expertReviewText === "string" ? expertReviewText.trim().slice(0, 2000) : ""
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 })
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data,
    select: {
      id: true,
      userId: true,
      expertId: true,
      expertName: true,
      date: true,
      startTime: true,
      status: true,
      expertRating: true,
      expertReviewText: true,
    },
  })

  return NextResponse.json({ booking: updated })
}
