import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { validateNoContactLeak } from "@/lib/contact-leak-validation"

export const runtime = "nodejs"

/** PATCH — update Shugyo project */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id } = await params
  try {
    const existing = await prisma.shugyoProject.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 })
    }

    const body = await req.json()
    const data: { title?: string; description?: string; imageUrl?: string } = {}
    if (body.title !== undefined) {
      const t = typeof body.title === "string" ? body.title.trim() : ""
      if (t.length < 2) {
        return NextResponse.json({ error: "Titel muss mindestens 2 Zeichen haben." }, { status: 400 })
      }
      const tl = validateNoContactLeak(t, "Titel")
      if (!tl.ok) return NextResponse.json({ error: tl.message }, { status: 400 })
      data.title = t
    }
    if (body.description !== undefined) {
      const d = typeof body.description === "string" ? body.description : ""
      const dl = validateNoContactLeak(d, "Beschreibung")
      if (!dl.ok) return NextResponse.json({ error: dl.message }, { status: 400 })
      data.description = d
    }
    if (body.imageUrl !== undefined) data.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : ""

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Aenderungen." }, { status: 400 })
    }

    const project = await prisma.shugyoProject.update({
      where: { id },
      data,
    })
    return NextResponse.json({ project })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** DELETE — remove Shugyo project */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id } = await params
  try {
    const existing = await prisma.shugyoProject.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 })
    }

    await prisma.shugyoProject.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
