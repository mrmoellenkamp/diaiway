import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * One-time migration: sets username for all users where username is null.
 * Uses name as base, appends a short suffix if the name is already taken.
 * GET  → dry-run (shows what would be changed, no writes)
 * POST → executes the migration
 */
export async function GET() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json({
    affected: users.length,
    preview: users.slice(0, 20).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      wouldSetUsername: sanitize(u.name || u.email.split("@")[0]),
    })),
    message: `${users.length} Nutzer ohne username gefunden. POST an diese Route um Migration auszuführen.`,
  })
}

export async function POST() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, name: true, email: true },
  })

  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const user of users) {
    const base = sanitize(user.name || user.email.split("@")[0])
    const username = await findAvailableUsername(base)
    if (!username) {
      errors.push(`${user.email}: kein freier Username gefunden`)
      skipped++
      continue
    }
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { username },
      })
      updated++
    } catch {
      errors.push(`${user.email}: DB-Fehler`)
      skipped++
    }
  }

  return NextResponse.json({
    total: users.length,
    updated,
    skipped,
    errors: errors.slice(0, 20),
    message: `Migration abgeschlossen: ${updated} aktualisiert, ${skipped} übersprungen.`,
  })
}

function sanitize(input: string): string {
  return input
    .trim()
    .replace(/[^\p{L}\p{N} ._'-]/gu, "")
    .trim()
    .slice(0, 30) || "nutzer"
}

async function findAvailableUsername(base: string): Promise<string | null> {
  // Try exact match first
  const existing = await prisma.user.findUnique({ where: { username: base } })
  if (!existing) return base

  // Try with numeric suffix
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base.slice(0, 27)}${i}`
    const taken = await prisma.user.findUnique({ where: { username: candidate } })
    if (!taken) return candidate
  }
  return null
}
