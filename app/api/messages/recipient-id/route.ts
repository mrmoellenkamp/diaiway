import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/** GET ?expertId=xxx — resolve expert to user id for messaging */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const expertId = req.nextUrl.searchParams.get("expertId")
  if (!expertId) {
    return NextResponse.json({ error: "expertId fehlt." }, { status: 400 })
  }

  const expert = await prisma.expert.findUnique({
    where: { id: expertId },
    select: { userId: true },
  })
  if (!expert?.userId) {
    return NextResponse.json({ error: "Experte nicht gefunden oder nicht mit Nutzer verknüpft." }, { status: 404 })
  }

  return NextResponse.json({ userId: expert.userId })
}
