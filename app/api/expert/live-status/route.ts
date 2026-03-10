import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const VALID = ["offline", "available", "in_call", "busy"] as const

/**
 * GET /api/expert/live-status — Aktueller Status des Takumi
 * PATCH /api/expert/live-status — Status setzen (body: { liveStatus })
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
    select: { liveStatus: true, lastSeenAt: true },
  })
  if (!expert) {
    return NextResponse.json({ liveStatus: "offline" })
  }

  return NextResponse.json({
    liveStatus: expert.liveStatus ?? "offline",
    lastSeenAt: expert.lastSeenAt?.toISOString() ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const appRole = (session.user as { appRole?: string })?.appRole
  if (appRole !== "takumi") {
    return NextResponse.json({ error: "Nur für Takumi." }, { status: 403 })
  }

  let body: { liveStatus?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 })
  }

  const status = body.liveStatus
  if (!status || !VALID.includes(status as (typeof VALID)[number])) {
    return NextResponse.json(
      { error: `liveStatus muss eines sein: ${VALID.join(", ")}` },
      { status: 400 }
    )
  }

  try {
    await prisma.expert.updateMany({
      where: { userId: session.user.id },
      data: {
        liveStatus: status as (typeof VALID)[number],
        lastSeenAt: new Date(),
      },
    })
    return NextResponse.json({ ok: true, liveStatus: status })
  } catch {
    return NextResponse.json({ error: "Fehler beim Setzen." }, { status: 500 })
  }
}
