import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/api-auth"
import { requireAdminApi } from "@/lib/require-admin"

export const runtime = "nodejs"

/**
 * PATCH /api/admin/guest-bookings/[id]
 * Actions: cancel | delete
 *
 * cancel – Admin OR the owning Takumi (booking.expert.userId); only if paymentStatus !== paid
 * delete – Admin only (hard delete)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const { action } = body as { action?: string }

  if (!action || !["cancel", "delete"].includes(action)) {
    return NextResponse.json({ error: "Ungültige Aktion. Erlaubt: cancel, delete." }, { status: 400 })
  }

  let cancelUserId: string | undefined
  let cancelJwtRole: string | undefined

  if (action === "delete") {
    const adminResult = await requireAdminApi()
    if (!adminResult.ok) return adminResult.response
  } else {
    // cancel: any logged-in user; ownership checked below
    const authResult = await requireAuth()
    if (authResult.response) return authResult.response
    cancelUserId = authResult.session.user.id
    cancelJwtRole = (authResult.session.user as { role?: string }).role
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { expert: { select: { userId: true } } },
  })

  if (!booking || !booking.isGuestCall) {
    return NextResponse.json({ error: "Gast-Buchung nicht gefunden." }, { status: 404 })
  }

  if (action === "cancel") {
    const uid = cancelUserId!
    let isAdmin = false
    if (cancelJwtRole === "admin") {
      const dbUser = await prisma.user.findUnique({
        where: { id: uid },
        select: { role: true },
      })
      isAdmin = dbUser?.role === "admin"
    }
    const isExpertOwner = booking.expert?.userId === uid
    if (!isAdmin && !isExpertOwner) {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
    }
    if (booking.paymentStatus === "paid") {
      return NextResponse.json({ error: "Bezahlte Buchungen können nicht storniert werden." }, { status: 409 })
    }
    await prisma.booking.update({
      where: { id },
      data: { status: "cancelled" },
    })
    return NextResponse.json({ ok: true, status: "cancelled" })
  }

  // delete (admin only – already verified above)
  await prisma.booking.delete({ where: { id } })
  return NextResponse.json({ ok: true, deleted: true })
}
