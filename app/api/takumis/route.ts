import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { emailForName } from "@/lib/email-utils"
import { requireAdmin } from "@/lib/api-auth"

export const runtime = "nodejs"

export async function GET() {
  try {
    const experts = await prisma.expert.findMany({
      include: { user: { select: { appRole: true } } },
      orderBy: { rating: "desc" },
    })
    // Nur aktive Takumis: Experten ohne User (Seed) ODER verknüpfter User hat appRole=takumi
    const active = experts.filter(
      (e) => !e.userId || (e.user?.appRole === "takumi")
    )

    const now = Date.now()
    const ONLINE_MS = 30 * 1000 // 30 s: Offline-Fallback erst wenn Heartbeat länger als 30s ausbleibt

    return NextResponse.json(
      active.map((e) => {
        const lastSeen = e.lastSeenAt?.getTime()
        const isActuallyOnline = lastSeen != null && now - lastSeen < ONLINE_MS
        const isLive = e.isLive && isActuallyOnline
        return {
        id: e.id,
        name: e.name,
        email: e.email,
        avatar: e.avatar,
        categorySlug: e.categorySlug,
        categoryName: e.categoryName,
        subcategory: e.subcategory,
        bio: e.bio,
        rating: e.rating,
        reviewCount: e.reviewCount,
        sessionCount: e.sessionCount,
        responseTime: e.responseTime,
        priceVideo15Min: Number(e.priceVideo15Min ?? (e.pricePerSession ? e.pricePerSession / 2 : 0)),
        priceVoice15Min: Number(e.priceVoice15Min ?? (e.pricePerSession ? e.pricePerSession / 2 : 0)),
        pricePerSession: e.pricePerSession,
        isLive,
        liveStatus: e.liveStatus ?? null,
        pricePerMinute: Math.round((Number(e.priceVideo15Min ?? (e.pricePerSession ? e.pricePerSession / 2 : 0)) * 100 / 15)),
        isPro: e.isPro,
        verified: e.verified,
        portfolio: e.portfolio,
        joinedDate: e.joinedDate,
        imageUrl: e.imageUrl,
        matchRate: e.matchRate,
        socialLinks: e.socialLinks ?? {},
        cancelPolicy: e.cancelPolicy ?? { freeHours: 24, feePercent: 0 },
      }
      })
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DB-Fehler"
    console.error("[diAiway] GET /api/takumis error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

/** POST — create a single expert (admin only) */
export async function POST(req: Request) {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response
  const { session } = authResult

  try {
    const body = await req.json()
    const required = ["name", "categorySlug", "categoryName", "subcategory", "bio", "pricePerSession"]
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `Feld '${field}' ist erforderlich.` }, { status: 400 })
      }
    }

    const expert = await prisma.expert.create({
      data: {
        name: body.name,
        email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : emailForName(body.name),
        avatar: body.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
        categorySlug: body.categorySlug,
        categoryName: body.categoryName,
        subcategory: body.subcategory,
        bio: body.bio,
        rating: body.rating ?? 5.0,
        reviewCount: 0,
        sessionCount: 0,
        responseTime: body.responseTime ?? "< 5 Min",
        priceVideo15Min: Math.max(1, body.priceVideo15Min != null ? Number(body.priceVideo15Min) : Number(body.pricePerSession) / 2),
        priceVoice15Min: Math.max(1, body.priceVoice15Min != null ? Number(body.priceVoice15Min) : Number(body.pricePerSession) / 2),
        pricePerSession: Number(body.pricePerSession),
        isLive: body.isLive ?? false,
        isPro: body.isPro ?? false,
        verified: false,
        portfolio: [],
        joinedDate: new Date().toISOString().slice(0, 10),
        imageUrl: body.imageUrl ?? "",
        matchRate: body.matchRate ?? 85,
      },
    })

    return NextResponse.json(
      { success: true, message: `Experte '${expert.name}' erfolgreich erstellt.`, id: expert.id },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler beim Erstellen"
    console.error("[diAiway] POST /api/takumis error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

/** PATCH — update expert (admin only, e.g. isLive toggle) */
export async function PATCH(req: Request) {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response

  try {
    const body = await req.json()
    const { id } = body
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Experten-ID erforderlich." }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.isLive === "boolean") data.isLive = body.isLive
    if (body.isPro !== undefined) data.isPro = !!body.isPro
    if (body.verified !== undefined) data.verified = !!body.verified

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen angegeben." }, { status: 400 })
    }

    await prisma.expert.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler beim Aktualisieren"
    console.error("[diAiway] PATCH /api/takumis error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}
