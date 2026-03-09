import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

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
 * Prüft, ob der Nutzer eingeloggt und Admin ist.
 * Gibt bei Erfolg { session } zurück, sonst { response } mit 401 oder 403.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth()
  if (result.response) return result
  const role = (result.session.user as { role?: string }).role
  if (role !== "admin") {
    return { response: NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 }) }
  }
  return result
}
