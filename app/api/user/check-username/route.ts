import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateUsername } from "@/lib/username-validation"
import { auth } from "@/lib/auth"

export const runtime = "nodejs"

/**
 * GET /api/user/check-username?username=foo
 * Public during registration (no auth required).
 * Authenticated users are excluded from the collision check so they don't
 * collide with their own current username.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username") ?? ""

  const validation = validateUsername(username)
  if (!validation.ok) {
    return NextResponse.json({ available: false, reason: validation.error }, { status: 200 })
  }

  const session = await auth().catch(() => null)
  const currentUserId = session?.user?.id ?? null

  const existing = await prisma.user.findFirst({
    where: {
      username: username.trim(),
      ...(currentUserId ? { NOT: { id: currentUserId } } : {}),
    },
    select: { id: true },
  })

  if (existing) {
    return NextResponse.json({ available: false, reason: "Dieser Benutzername ist bereits vergeben." })
  }

  return NextResponse.json({ available: true })
}
