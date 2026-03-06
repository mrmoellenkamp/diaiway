import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * POST /api/admin/reset-db
 * Truncates all application data tables in the correct order
 * (respecting foreign key constraints).
 */
export async function POST() {
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
