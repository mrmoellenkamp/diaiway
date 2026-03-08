import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** POST — create portfolio project (Takumi only) */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

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
    if (!title || title.length < 2) {
      return NextResponse.json({ error: "Titel muss mindestens 2 Zeichen haben." }, { status: 400 })
    }

    const completionDate = body.completionDate
      ? new Date(body.completionDate)
      : null

    const project = await prisma.takumiPortfolioProject.create({
      data: {
        userId: session.user.id,
        title,
        description: typeof body.description === "string" ? body.description.trim() : "",
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : "",
        category: typeof body.category === "string" ? body.category.trim() : "",
        completionDate,
      },
    })
    return NextResponse.json({ project })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
