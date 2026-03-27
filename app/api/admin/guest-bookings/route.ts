import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/api-auth"

export const runtime = "nodejs"

/**
 * GET /api/admin/guest-bookings
 * List all guest bookings with expert info, sorted by date desc.
 * Query params: ?status=unpaid|paid|all  ?search=email
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAdminApi()
  if (authResult.response) return authResult.response

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get("status") || "all"
  const search = searchParams.get("search")?.trim().toLowerCase() || ""

  const bookings = await prisma.booking.findMany({
    where: {
      isGuestCall: true,
      ...(statusFilter !== "all" ? { paymentStatus: statusFilter } : {}),
      ...(search ? { guestEmail: { contains: search, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      guestToken: true,
      guestEmail: true,
      date: true,
      startTime: true,
      endTime: true,
      totalPrice: true,
      paymentStatus: true,
      status: true,
      callType: true,
      note: true,
      createdAt: true,
      expert: {
        select: {
          id: true,
          name: true,
          email: true,
          userId: true,
        },
      },
    },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 200,
  })

  return NextResponse.json({ bookings })
}
