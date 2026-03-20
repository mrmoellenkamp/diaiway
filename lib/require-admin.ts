import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function requireAdminApi() {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }) }
  }
  const role = (session.user as { role?: string }).role
  if (role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 }) }
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })
  if (!dbUser || dbUser.role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 }) }
  }
  return { ok: true as const, userId: session.user.id }
}
