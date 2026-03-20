import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { corsPreflightResponse, withApiCors } from "@/lib/api-cors"

/**
 * GET /api/expert/instant-requests
 * Takumi: Offene PENDING Instant-Buchungen (Anklopf).
 * CORS: Capacitor / alternative Origins (Safari „access control checks“).
 */
export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request)
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return withApiCors(request, NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }))
  }

  const appRole = (session.user as { appRole?: string })?.appRole
  if (appRole !== "takumi") {
    return withApiCors(request, NextResponse.json({ error: "Nur für Takumi." }, { status: 403 }))
  }

  const expert = await prisma.expert.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!expert) {
    return withApiCors(request, NextResponse.json({ requests: [] }))
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

  return withApiCors(
    request,
    NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        userName: r.userName,
        statusToken: r.statusToken,
        createdAt: r.createdAt.toISOString(),
      })),
    }),
  )
}
