import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { corsPreflightResponse, withApiCors } from "@/lib/api-cors"
import { communicationUsername } from "@/lib/communication-display"
import { translateError } from "@/lib/api-handler"
import { isDbConnectionError } from "@/lib/is-db-connection-error"

/**
 * GET /api/expert/instant-requests
 * Takumi: Offene PENDING Instant-Buchungen (Anklopf).
 * CORS: Capacitor / alternative Origins (Safari „access control checks“).
 */
export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request)
}

export async function GET(request: Request) {
  try {
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
        user: { select: { username: true } },
      },
    })

    return withApiCors(
      request,
      NextResponse.json({
        requests: requests.map((r) => ({
          id: r.id,
          userName: communicationUsername(r.user?.username, "Shugyo"),
          statusToken: r.statusToken,
          createdAt: r.createdAt.toISOString(),
        })),
      }),
    )
  } catch (err) {
    if (!isDbConnectionError(err)) {
      console.error("[api/expert/instant-requests]", err)
    }
    return withApiCors(request, translateError(err))
  }
}
