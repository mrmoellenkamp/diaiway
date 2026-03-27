import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/api-auth"

export const runtime = "nodejs"

/**
 * PATCH /api/admin/guest-bookings/[id]
 * Actions: cancel | delete
 * Also used by Takumi to cancel their own guest booking (action: cancel).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Allow both admin and the owning takumi
  const body = await req.json().catch(() => ({}))
  const { action } = body as { action?: string }

  if (!action || !["cancel", "delete"].includes(action)) {
    return NextResponse.json({ error: "Ungültige Aktion. Erlaubt: cancel, delete." }, { status: 400 })
  }

  // For delete, require admin
  if (action === "delete") {
    const authResult = await requireAdminApi()
    if (authResult.response) return authResult.response
  } else {
    // For cancel: accept admin OR the owning takumi (checked below)
    const { requireAuth } = await import("@/lib/api-auth")
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { expert: { select: { userId: true } } },
  })

  if (!booking || !booking.isGuestCall) {
    return NextResponse.json({ error: "Gast-Buchung nicht gefunden." }, { status: 404 })
  }

  if (action === "cancel") {
    if (booking.paymentStatus === "paid") {
      return NextResponse.json({ error: "Bezahlte Buchungen können nicht storniert werden." }, { status: 409 })
    }
    await prisma.booking.update({
      where: { id },
      data: { status: "cancelled" },
    })
    return NextResponse.json({ ok: true, status: "cancelled" })
  }

  if (action === "delete") {
    await prisma.booking.delete({ where: { id } })
    return NextResponse.json({ ok: true, deleted: true })
  }

  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 })
}
