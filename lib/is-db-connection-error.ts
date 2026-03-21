/**
 * Erkennt typische Prisma/Netzwerk-Fehler bei DB nicht erreichbar (Cold Start, Pooler, Timeout).
 * Gleiche Logik wie Admin-Layout: bei diesen Fehlern JWT vorübergehend vertrauen statt hart zu scheitern.
 */
export function isDbConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const name = err instanceof Error ? err.constructor.name : ""
  const msg = err instanceof Error ? err.message : ""
  const code = (err as { code?: string }).code
  return (
    name === "PrismaClientInitializationError" ||
    (name === "PrismaClientKnownRequestError" &&
      (code === "P1001" || code === "P1002" || code === "P2024")) ||
    msg.includes("Can't reach database") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("connect ETIMEDOUT")
  )
}
