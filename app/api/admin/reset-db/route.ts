import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * POST /api/admin/reset-db
 * Truncates all application data tables in the correct order
 * (respecting foreign key constraints).
 * Requires admin session. Nur in Non-Production verfügbar.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DB-Reset in Production deaktiviert." }, { status: 404 })
  }
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }
  try {
    // Order matters: delete children before parents
    const [reviews, bookings, availability, experts, users] = await prisma.$transaction([
      prisma.review.deleteMany(),
      prisma.booking.deleteMany(),
      prisma.availability.deleteMany(),
      prisma.expert.deleteMany(),
      prisma.user.deleteMany(),
    ])

    return NextResponse.json({
      message: "Datenbank komplett zurueckgesetzt.",
      deleted: {
        reviews: reviews.count,
        bookings: bookings.count,
        availability: availability.count,
        experts: experts.count,
        users: users.count,
      },
    })
  } catch (error) {
    console.error("DB reset error:", error)
    return NextResponse.json({ error: "Fehler beim Zuruecksetzen." }, { status: 500 })
  }
}
