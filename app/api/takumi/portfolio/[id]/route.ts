import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

async function ensureTakumi(session: { user: { id: string } } | null) {
  if (!session?.user?.id) {
    return { error: "Nicht eingeloggt." as const, status: 401 as const }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { appRole: true },
  })
  if (user?.appRole !== "takumi") {
    return { error: "Nur Takumi dürfen Portfolio-Einträge bearbeiten." as const, status: 403 as const }
  }
  return { userId: session.user.id }
}

/** PATCH — update portfolio project (Takumi only) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const check = await ensureTakumi(session)
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params
  try {
    const existing = await prisma.takumiPortfolioProject.findUnique({ where: { id } })
    if (!existing || existing.userId !== check.userId) {
      return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 })
    }

    const body = await req.json()
    const data: { title?: string; description?: string; imageUrl?: string; category?: string; completionDate?: Date | null } = {}
    if (body.title !== undefined) {
      const t = typeof body.title === "string" ? body.title.trim() : ""
      if (t.length < 2) {
        return NextResponse.json({ error: "Titel muss mindestens 2 Zeichen haben." }, { status: 400 })
      }
      data.title = t
    }
    if (body.description !== undefined) data.description = typeof body.description === "string" ? body.description : ""
    if (body.imageUrl !== undefined) data.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : ""
    if (body.category !== undefined) data.category = typeof body.category === "string" ? body.category : ""
    if (body.completionDate !== undefined) {
      data.completionDate = body.completionDate ? new Date(body.completionDate) : null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 })
    }

    const project = await prisma.takumiPortfolioProject.update({
      where: { id },
      data,
    })
    return NextResponse.json({ project })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** DELETE — remove portfolio project (Takumi only) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const check = await ensureTakumi(session)
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params
  try {
    const existing = await prisma.takumiPortfolioProject.findUnique({ where: { id } })
    if (!existing || existing.userId !== check.userId) {
      return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 })
    }

    await prisma.takumiPortfolioProject.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
