import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isDbConnectionError } from "@/lib/is-db-connection-error"

type SessionWithUser = Awaited<ReturnType<typeof auth>> & { user: { id: string; name?: string | null; email?: string | null } }

export type AuthResult =
  | { session: SessionWithUser; response?: never }
  | { session?: never; response: NextResponse }

/**
 * Prüft, ob der Nutzer eingeloggt ist.
 * Gibt bei Erfolg { session } zurück, sonst { response } mit 401.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 }) }
  }
  return { session: session as unknown as SessionWithUser }
}

/**
 * Prüft, ob der Nutzer eingeloggt und Admin ist (Rolle zusätzlich aus DB wie Admin-Layout).
 * Bei typischen DB-Verbindungsfehlern: Fallback auf JWT, damit Cold Starts nicht alle Admin-APIs blockieren.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth()
  if (result.response) return result
  const role = (result.session.user as { role?: string }).role
  if (role !== "admin") {
    return { response: NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 }) }
  }
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: result.session.user.id },
      select: { role: true },
    })
    if (!dbUser || dbUser.role !== "admin") {
      return { response: NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 }) }
    }
  } catch (err: unknown) {
    if (isDbConnectionError(err)) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn("[requireAdmin] DB-Check übersprungen (Verbindung):", msg.slice(0, 120))
    } else {
      throw err
    }
  }
  return result
}
