import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"

const TRANSIENT_CONNECTIVITY_CODES = new Set(["P1001", "P1002", "P2024", "P2037"])

/**
 * Netzwerk / Erreichbarkeit / Init — nicht „Schema falsch“.
 */
export function isPrismaConnectivityError(err: unknown): boolean {
  if (err instanceof PrismaClientKnownRequestError) {
    return TRANSIENT_CONNECTIVITY_CODES.has(err.code)
  }
  if (err instanceof Error) {
    const m = err.message
    return (
      m.includes("Can't reach database server") ||
      m.includes("db.prisma.io") ||
      m.includes("PrismaClientInitializationError") ||
      m.includes("Server has closed the connection") ||
      m.includes("Connection refused") ||
      m.includes("ETIMEDOUT") ||
      m.includes("ECONNRESET")
    )
  }
  return false
}

/** Kurze Wiederholungen bei flaky Serverless / Cold-Start zum Pooler */
export async function withPrismaConnectivityRetries<T>(
  task: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number }
): Promise<T> {
  const attempts = options?.attempts ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 350
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await task()
    } catch (e) {
      last = e
      if (!isPrismaConnectivityError(e) || i === attempts - 1) throw e
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)))
    }
  }
  throw last
}

/** Default für Health-/Diagnose-Endpunkte (Vercel-Timeout vermeiden). */
export const DB_PROBE_TIMEOUT_MS = 8_000

/**
 * Bricht ab, wenn die Promise länger als `ms` braucht (z. B. hängende TCP-Verbindung).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "Operation"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      reject(
        Object.assign(new Error(`${label} timed out after ${ms}ms`), {
          code: "TIMEOUT",
        })
      )
    }, ms)
    promise.then(
      (v) => {
        clearTimeout(id)
        resolve(v)
      },
      (e) => {
        clearTimeout(id)
        reject(e)
      }
    )
  })
}

/** Admin/UI: kein Rohtext aus Prisma an Endnutzer */
export function getDatabaseUnavailableDegradedMessage(_err: unknown): string {
  return (
    "Datenbank nicht erreichbar. Auf Vercel DATABASE_URL und DIRECT_URL prüfen (exakt aus der Prisma Console kopieren), " +
    "sicherstellen dass die DB aktiv ist, danach Redeploy. Anleitung: docs/TROUBLESHOOTING-DATABASE.md"
  )
}

export function getAdminStatsDegradedMessage(err: unknown): string {
  if (isPrismaConnectivityError(err)) {
    return getDatabaseUnavailableDegradedMessage(err)
  }
  const msg = err instanceof Error ? err.message : String(err)
  const short = msg.length > 220 ? `${msg.slice(0, 220)}…` : msg
  const isSchema =
    /does not exist|relation|Unknown column|column|migration|P20[0-9]{2}/i.test(msg)
  if (isSchema) {
    return `Datenbank-Schema passt nicht zum Code (${short}). Auf dem Server „npm run db:migrate:deploy“ ausführen.`
  }
  return `Statistik-Abfragen fehlgeschlagen: ${short}`
}
