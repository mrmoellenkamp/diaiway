import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { validateNoContactLeak } from "@/lib/contact-leak-validation"
import { assertRateLimit } from "@/lib/api-rate-limit"
import { imageUrlSchema } from "@/lib/schemas/common"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"

/** GET — list portfolio projects. Query: ?expertId=xxx for public view, else own (Takumi only) */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const expertId = req.nextUrl.searchParams.get("expertId")

    if (expertId) {
      // Public: Shugyo viewing Takumi profile — get by Expert ID
      const expert = await prisma.expert.findUnique({
        where: { id: expertId },
        select: { userId: true },
      })
      if (!expert?.userId) {
        return NextResponse.json({ projects: [] })
      }
      const projects = await prisma.takumiPortfolioProject.findMany({
        where: { userId: expert.userId },
        orderBy: [{ completionDate: "desc" }, { createdAt: "desc" }],
      })
      return NextResponse.json({
        projects: projects.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          imageUrl: p.imageUrl,
          category: p.category,
          completionDate: p.completionDate,
          createdAt: p.createdAt,
        })),
      })
    }

    // Own portfolio — any logged-in user can read (Daten bleiben bei Rollenwechsel erhalten)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
    }

    const projects = await prisma.takumiPortfolioProject.findMany({
      where: { userId: session.user.id },
      orderBy: [{ completionDate: "desc" }, { createdAt: "desc" }],
    })
    return NextResponse.json({ projects })
  } catch (err: unknown) {
    logSecureError("takumi.portfolio.GET", err)
    return NextResponse.json({ error: "Serverfehler." }, { status: 500 })
  }
}

/** POST — create portfolio project (Takumi only) */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "takumi:portfolio:create", limit: 30, windowSec: 3600 }
  )
  if (rl) return rl

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { appRole: true },
  })
  if (user?.appRole !== "takumi") {
    return NextResponse.json({ error: "Nur Takumi dürfen Portfolio-Einträge erstellen." }, { status: 403 })
  }

  try {
    const body = await req.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title || title.length < 2 || title.length > 200) {
      return NextResponse.json({ error: "Titel: 2–200 Zeichen." }, { status: 400 })
    }

    const completionDate = body.completionDate ? new Date(body.completionDate) : null
    if (completionDate && Number.isNaN(completionDate.getTime())) {
      return NextResponse.json({ error: "Ungültiges Datum." }, { status: 400 })
    }

    const desc = typeof body.description === "string" ? body.description.trim() : ""
    if (desc.length > 5000) {
      return NextResponse.json({ error: "Beschreibung zu lang." }, { status: 400 })
    }
    const titleLeak = validateNoContactLeak(title, "Titel")
    if (!titleLeak.ok) return NextResponse.json({ error: titleLeak.message }, { status: 400 })
    const descLeak = validateNoContactLeak(desc, "Beschreibung")
    if (!descLeak.ok) return NextResponse.json({ error: descLeak.message }, { status: 400 })

    const category = typeof body.category === "string" ? body.category.trim() : ""
    if (category.length > 100) {
      return NextResponse.json({ error: "Kategorie zu lang." }, { status: 400 })
    }
    const catLeak = validateNoContactLeak(category, "Kategorie")
    if (!catLeak.ok) return NextResponse.json({ error: catLeak.message }, { status: 400 })

    // Nur Vercel-Blob oder signierte Proxy-URLs erlauben.
    let imageUrl = ""
    if (typeof body.imageUrl === "string" && body.imageUrl.length > 0) {
      const parsed = imageUrlSchema.safeParse(body.imageUrl)
      if (!parsed.success) {
        return NextResponse.json({ error: "Ungültige Bild-URL." }, { status: 400 })
      }
      imageUrl = parsed.data
    }

    const project = await prisma.takumiPortfolioProject.create({
      data: {
        userId: session.user.id,
        title,
        description: desc,
        imageUrl,
        category,
        completionDate,
      },
    })
    return NextResponse.json({ project })
  } catch (err: unknown) {
    logSecureError("takumi.portfolio.POST", err)
    return NextResponse.json({ error: "Serverfehler." }, { status: 500 })
  }
}
