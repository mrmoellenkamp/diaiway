import { NextRequest, NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { auth } from "@/lib/auth"
import { anonymizeUser } from "@/lib/anonymize-user"

export const runtime = "nodejs"

/**
 * PATCH /api/user/account
 * Pause or resume the own account.
 * Body: { action: "pause" | "resume" }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { action } = await req.json()
  if (action !== "pause" && action !== "resume") {
    return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 })
  }

  const newStatus = action === "pause" ? "paused" : "active"

  const { prisma } = await import("@/lib/db")

  await prisma.user.update({
    where: { id: session.user.id },
    data: { status: newStatus },
  })

  // Takumi pausieren: Sofort offline, nicht mehr im Instant-Connect sichtbar
  if (action === "pause") {
    await prisma.expert.updateMany({
      where: { userId: session.user.id },
      data: { isLive: false, liveStatus: "offline" },
    })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}

/**
 * DELETE /api/user/account
 * DSGVO-konforme Kontolöschung (Anonymisierung statt Hard-Delete).
 * - Name/E-Mail → Platzhalter, Profilbild aus Blob gelöscht
 * - Wallet-Historie bleibt erhalten
 * - Admin-Konten sind geschützt
 */
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const result = await anonymizeUser(session.user.id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 })
  }

  // Blob-Bilder physisch löschen (außerhalb DB-Transaktion)
  for (const url of result.imageUrls) {
    try {
      await del(url)
    } catch (err) {
      console.warn("[account/delete] Blob delete failed:", url, err)
    }
  }

  return NextResponse.json({ ok: true })
}
