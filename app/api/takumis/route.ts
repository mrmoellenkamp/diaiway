import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function emailForName(name: string): string {
  const local = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")
  return `${local || "expert"}@diaiway.test`
}

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

    return NextResponse.json(
      active.map((e) => ({
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
        pricePerSession: e.pricePerSession,
        isLive: e.isLive,
        isPro: e.isPro,
        verified: e.verified,
        portfolio: e.portfolio,
        joinedDate: e.joinedDate,
        imageUrl: e.imageUrl,
        matchRate: e.matchRate,
        socialLinks: e.socialLinks ?? {},
        cancelPolicy: e.cancelPolicy ?? { freeHours: 24, feePercent: 0 },
      }))
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DB-Fehler"
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[diAiway] GET /api/takumis error:", message, stack)
    return NextResponse.json(
      { error: message, ...(process.env.NODE_ENV === "development" && stack && { stack }) },
      { status: 500 }
    )
  }
}

/** POST — create a single expert (admin only) */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json(
      { error: "Nicht autorisiert. Nur Admins koennen Experten erstellen." },
      { status: 401 }
    )
  }

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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH — update expert (admin only, e.g. isLive toggle) */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert. Nur Admins." }, { status: 401 })
  }

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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
