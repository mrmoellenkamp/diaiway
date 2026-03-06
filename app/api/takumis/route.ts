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
    const experts = await prisma.expert.findMany({ orderBy: { rating: "desc" } })

    return NextResponse.json(
      experts.map((e) => ({
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
      }))
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DB-Fehler"
    console.error("[diAiway] GET /api/takumis error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
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
