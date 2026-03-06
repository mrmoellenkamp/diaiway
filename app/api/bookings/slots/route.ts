import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/bookings/slots?takumiId=xxx&date=YYYY-MM-DD
 * Returns all pending+confirmed+active booking slots for a given expert on a given date.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const takumiId = searchParams.get("takumiId")
  const date = searchParams.get("date")

  if (!takumiId || !date) {
    return NextResponse.json({ error: "takumiId und date erforderlich." }, { status: 400 })
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        expertId: takumiId,
        date,
        status: { in: ["pending", "confirmed", "active"] },
      },
      select: { startTime: true, endTime: true, status: true },
    })

    return NextResponse.json({
      blockedSlots: bookings.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
      })),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
