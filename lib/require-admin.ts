import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isDbConnectionError } from "@/lib/is-db-connection-error"

/**
 * Admin-API: JWT + Rolle aus DB (wie /admin Layout). Bei DB-Verbindungsfehler Fallback auf JWT
 * (Vercel Cold Start / Pooler) — gleiches Verhalten wie `app/(app)/admin/layout.tsx`.
 */
export async function requireAdminApi() {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }) }
  }
  const role = (session.user as { role?: string }).role
  if (role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 }) }
  }
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    })
    if (!dbUser || dbUser.role !== "admin") {
      return { ok: false as const, response: NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 }) }
    }
  } catch (err: unknown) {
    if (isDbConnectionError(err)) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn("[requireAdminApi] DB-Check übersprungen (Verbindung):", msg.slice(0, 120))
    } else {
      console.error("[requireAdminApi]", err)
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Serverfehler bei Berechtigungsprüfung." }, { status: 500 }),
      }
    }
  }
  return { ok: true as const, userId: session.user.id }
}
