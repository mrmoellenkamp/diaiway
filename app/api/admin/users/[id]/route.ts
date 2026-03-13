import { NextRequest, NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { anonymizeUser } from "@/lib/anonymize-user"

const VALID_ROLES = ["user", "admin"] as const
const VALID_APP_ROLES = ["shugyo", "takumi"] as const
const VALID_STATUSES = ["active", "paused"] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { role, appRole, name, status } = body as { role?: string; appRole?: string; name?: string; status?: string }

  const data: { role?: "user" | "admin"; appRole?: "shugyo" | "takumi"; name?: string; status?: "active" | "paused" } = {}
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role as "user" | "admin")) {
      return NextResponse.json({ error: "Ungültige Rolle." }, { status: 400 })
    }
    data.role = role as "user" | "admin"
  }
  if (appRole !== undefined) {
    if (!VALID_APP_ROLES.includes(appRole as "shugyo" | "takumi")) {
      return NextResponse.json({ error: "Ungültige App-Rolle." }, { status: 400 })
    }
    data.appRole = appRole as "shugyo" | "takumi"
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as "active" | "paused")) {
      return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 })
    }
    data.status = status as "active" | "paused"
  }
  if (name !== undefined) {
    const trimmed = typeof name === "string" ? name.trim() : ""
    if (trimmed.length < 2) return NextResponse.json({ error: "Name muss mindestens 2 Zeichen haben." }, { status: 400 })
    if (trimmed.length > 200) return NextResponse.json({ error: "Name zu lang." }, { status: 400 })
    data.name = trimmed
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen angegeben." }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, appRole: true, status: true },
  })

  // ── Sync Expert record on appRole change ──────────────────────────────────
  if (appRole === "takumi") {
    // Create a placeholder Expert if none exists — data is preserved if one already exists
    const existing = await prisma.expert.findUnique({ where: { userId: id } })
    if (!existing) {
      await prisma.expert.create({
        data: {
          userId:          id,
          name:            updated.name,
          avatar:          updated.name.charAt(0).toUpperCase(),
          email:           "",
          categorySlug:    "dienstleistungen",
          categoryName:    "Dienstleistungen",
          subcategory:     "",
          bio:             "",
          priceVideo15Min: 0,
          priceVoice15Min: 0,
          pricePerSession: 0,
          rating:          0,
          reviewCount:     0,
          sessionCount:    0,
          isLive:          false,
          isPro:           false,
          verified:        false,
          portfolio:       [],
          joinedDate:      new Date().toISOString().slice(0, 10),
          matchRate:       0,
        },
      })
    }
    // If expert exists already, leave all their data intact
  }
  // When switching back to shugyo: Expert record is intentionally kept (data preserved)

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Prevent self-deletion
  if (id === (session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Kann den eigenen Account nicht löschen" }, { status: 400 })
  }

  const result = await anonymizeUser(id)

  if (!result.ok) {
    // anonymizeUser blockiert Admin-Konten
    return NextResponse.json({ error: result.error }, { status: 403 })
  }

  // Blob-Bilder physisch löschen
  for (const url of result.imageUrls) {
    try {
      await del(url)
    } catch (err) {
      console.warn("[admin/users/delete] Blob delete failed:", url, err)
    }
  }

  return NextResponse.json({ ok: true })
}
