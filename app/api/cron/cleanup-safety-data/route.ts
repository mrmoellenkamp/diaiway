import { list, del } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Cron: DSGVO-konforme Löschung temporärer Safety-Blob-Daten.
 *
 * Logik:
 * 1. Alle Blob-URLs aus SafetyIncident (laufende Verfahren) → Schutzliste.
 * 2. Alle Blobs im Prefix "safety-incidents/" auflisten.
 * 3. Blobs älter 48h, die NICHT in der Schutzliste stehen → löschen.
 *
 * Aufbewahrung: Incident-Bilder (verknüpfte SafetyIncidents) bleiben erhalten,
 * bis der Incident manuell resolvedAt gesetzt wird und ein erneuter Lauf sie
 * aus der Schutzliste entfernt hat (nach Ablauf der gesetzlichen Aufbewahrungsfrist).
 *
 * DSGVO Art. 5 Abs. 1 lit. e – Speicherbegrenzung:
 * Nicht für Verfahren benötigte Aufnahmen werden nach 48h gelöscht.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) {
    console.error("[Cron/cleanup-safety-data] CRON_SECRET not configured")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 1. Schutzliste: alle Blob-URLs aktiver/offener SafetyIncidents
    const incidents = await prisma.safetyIncident.findMany({
      select: { imageUrl: true },
    })
    const protectedUrls = new Set(incidents.map((i) => i.imageUrl))

    // 2. Alle Blobs im Safety-Prefix auflisten (paginiert)
    const cutoffMs = Date.now() - 48 * 60 * 60 * 1000
    let cursor: string | undefined
    const toDelete: string[] = []

    do {
      const result = await list({
        prefix: "safety-incidents/",
        limit: 1000,
        cursor,
      })

      for (const blob of result.blobs) {
        const uploadedAt = new Date(blob.uploadedAt).getTime()
        if (uploadedAt < cutoffMs && !protectedUrls.has(blob.url)) {
          toDelete.push(blob.url)
        }
      }

      cursor = result.cursor
    } while (cursor)

    // 3. Löschen in Batches (Vercel Blob del() akzeptiert Array)
    let deletedCount = 0
    const BATCH = 100
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const batch = toDelete.slice(i, i + BATCH)
      await del(batch)
      deletedCount += batch.length
    }

    await prisma.cronRunLog.upsert({
      where: { cronName: "cleanup-safety-data" },
      create: { cronName: "cleanup-safety-data", lastRunAt: new Date() },
      update: { lastRunAt: new Date() },
    })

    console.log(`[Cron/cleanup-safety-data] Deleted ${deletedCount} blobs. Protected: ${protectedUrls.size}.`)
    return NextResponse.json({
      ok: true,
      deletedCount,
      protectedCount: protectedUrls.size,
    })
  } catch (err) {
    console.error("[Cron/cleanup-safety-data] Error:", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Cleanup fehlgeschlagen." },
      { status: 500 }
    )
  }
}
