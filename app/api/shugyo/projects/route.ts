import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { validateNoContactLeak } from "@/lib/contact-leak-validation"
import { assertRateLimit } from "@/lib/api-rate-limit"
import { imageUrlSchema } from "@/lib/schemas/common"
import { logSecureError } from "@/lib/log-redact"

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
    logSecureError("shugyo.projects.GET", err)
    return NextResponse.json({ error: "Serverfehler." }, { status: 500 })
  }
}

/** POST — create new Shugyo project */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "shugyo:projects:create", limit: 30, windowSec: 3600 }
  )
  if (rl) return rl

  try {
    const body = await req.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title || title.length < 2 || title.length > 200) {
      return NextResponse.json({ error: "Titel: 2–200 Zeichen." }, { status: 400 })
    }
    const description = typeof body.description === "string" ? body.description.trim() : ""
    if (description.length > 5000) {
      return NextResponse.json({ error: "Beschreibung zu lang." }, { status: 400 })
    }
    const tl = validateNoContactLeak(title, "Titel")
    if (!tl.ok) return NextResponse.json({ error: tl.message }, { status: 400 })
    const dl = validateNoContactLeak(description, "Beschreibung")
    if (!dl.ok) return NextResponse.json({ error: dl.message }, { status: 400 })

    let imageUrl = ""
    if (typeof body.imageUrl === "string" && body.imageUrl.length > 0) {
      const parsed = imageUrlSchema.safeParse(body.imageUrl)
      if (!parsed.success) {
        return NextResponse.json({ error: "Ungültige Bild-URL." }, { status: 400 })
      }
      imageUrl = parsed.data
    }

    const project = await prisma.shugyoProject.create({
      data: {
        userId: session.user.id,
        title,
        description,
        imageUrl,
      },
    })
    return NextResponse.json({ project })
  } catch (err: unknown) {
    logSecureError("shugyo.projects.POST", err)
    return NextResponse.json({ error: "Serverfehler." }, { status: 500 })
  }
}
