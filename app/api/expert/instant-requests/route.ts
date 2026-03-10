import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/expert/instant-requests
 * Takumi: Offene PENDING Instant-Buchungen (Anklopf).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const appRole = (session.user as { appRole?: string })?.appRole
  if (appRole !== "takumi") {
    return NextResponse.json({ error: "Nur für Takumi." }, { status: 403 })
  }

  const expert = await prisma.expert.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!expert) {
    return NextResponse.json({ requests: [] })
  }

  const requests = await prisma.booking.findMany({
    where: {
      expertId: expert.id,
      bookingMode: "instant",
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userName: true,
      statusToken: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      userName: r.userName,
      statusToken: r.statusToken,
      createdAt: r.createdAt.toISOString(),
    })),
  })
}
