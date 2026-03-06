import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * PATCH /api/user/account
 * Pause or resume the own account.
 * Body: { action: "pause" | "resume" }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { action } = await req.json()
  if (action !== "pause" && action !== "resume") {
    return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 })
  }

  const newStatus = action === "pause" ? "paused" : "active"

  await prisma.user.update({
    where: { id: session.user.id },
    data: { status: newStatus },
  })

  // If pausing and user is a takumi, take them offline
  if (action === "pause") {
    await prisma.expert.updateMany({
      where: { userId: session.user.id },
      data: { isLive: false },
    })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}

/**
 * DELETE /api/user/account
 * Permanent GDPR-compliant account deletion.
 * - Booking records are anonymised (retained for legal/tax purposes per § 147 AO)
 * - All personal data, expert profile, availability, reviews are deleted
 */
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const id = session.user.id

  await prisma.$transaction([
    // Anonymise booking history (retained for financial compliance)
    prisma.booking.updateMany({
      where: { userId: id },
      data: {
        userName:  "[Gelöschter Nutzer]",
        userEmail: "deleted@deleted",
      },
    }),
    // Remove personal reviews
    prisma.review.deleteMany({ where: { userId: id } }),
    // Remove availability data
    prisma.availability.deleteMany({ where: { userId: id } }),
    // Delete the user record (cascades to Expert via onDelete: SetNull)
    prisma.user.delete({ where: { id } }),
  ])

  return NextResponse.json({ ok: true })
}
