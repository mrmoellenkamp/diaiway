import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/** GET — list Shugyo projects for current user */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const projects = await prisma.shugyoProject.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ projects })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** POST — create new Shugyo project */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title || title.length < 2) {
      return NextResponse.json({ error: "Titel muss mindestens 2 Zeichen haben." }, { status: 400 })
    }

    const project = await prisma.shugyoProject.create({
      data: {
        userId: session.user.id,
        title,
        description: typeof body.description === "string" ? body.description.trim() : "",
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : "",
      },
    })
    return NextResponse.json({ project })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
