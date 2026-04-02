import { del } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Cron: purge-expired-documents (monatlich, 1. des Monats 02:00 UTC)
 *
 * Löscht abgelaufene Dokumente aus dem DocumentArchive:
 * 1. Alle Einträge mit `retainUntil` in der Vergangenheit und `purgedAt = null`.
 * 2. Blob physisch via Vercel del().
 * 3. `purgedAt` setzen (Record bleibt für Audit).
 *
 * Aufbewahrungsfristen werden beim Archivieren gesetzt (archive-documents Cron).
 * §§ 147 AO, 257 HGB: Rechnungen 10 Jahre, Handels-/Buchungsbelege 6 Jahre.
 *
 * DSGVO Art. 5 Abs. 1 lit. e – Speicherbegrenzung: Löschung nach Ende der
 * gesetzlich vorgeschriebenen Aufbewahrungsfrist.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  const expired = await prisma.documentArchive.findMany({
    where: {
      retainUntil: { lt: now },
      purgedAt: null,
    },
    select: { id: true, blobUrl: true, docNumber: true, docType: true },
  })

  let purged = 0
  let errors = 0
  const BATCH = 50

  for (let i = 0; i < expired.length; i += BATCH) {
    const batch = expired.slice(i, i + BATCH)
    const urlsToDelete = batch.map((e) => e.blobUrl).filter(Boolean)

    try {
      if (urlsToDelete.length > 0) {
        await del(urlsToDelete)
      }
      await prisma.documentArchive.updateMany({
        where: { id: { in: batch.map((e) => e.id) } },
        data: { purgedAt: now },
      })
      purged += batch.length
    } catch (err) {
      console.error("[Cron/purge-expired-documents] Batch error:", err)
      errors += batch.length
    }
  }

  await prisma.cronRunLog.upsert({
    where: { cronName: "purge-expired-documents" },
    create: { cronName: "purge-expired-documents", lastRunAt: now },
    update: { lastRunAt: now },
  })

  console.log(`[Cron/purge-expired-documents] Purged: ${purged}, Errors: ${errors}, Total expired: ${expired.length}`)
  return NextResponse.json({ ok: true, purged, errors, totalExpired: expired.length })
}
