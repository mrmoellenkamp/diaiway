import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
  const { role, appRole, name, status } = body

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(role    ? { role }    : {}),
      ...(appRole ? { appRole } : {}),
      ...(name    ? { name }    : {}),
      ...(status  ? { status }  : {}),
    },
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
          priceVideo15Min: 1,
          priceVoice15Min: 1,
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

  // GDPR-compliant: anonymize booking records, then delete user
  await prisma.$transaction([
    prisma.booking.updateMany({
      where: { userId: id },
      data: { userName: "[Gelöschter Nutzer]", userEmail: "deleted@deleted" },
    }),
    prisma.review.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])

  return NextResponse.json({ ok: true })
}
