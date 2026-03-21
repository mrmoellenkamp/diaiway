import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  DB_PROBE_TIMEOUT_MS,
  isPrismaConnectivityError,
  withTimeout,
} from "@/lib/prisma-connectivity"

export const runtime = "nodejs"

/**
 * GET /api/health
 * Liveness: antwortet immer mit HTTP 200, sobald die App läuft.
 * `database.connected` zeigt, ob PostgreSQL innerhalb des Timeouts erreichbar ist.
 * (Kein 500 bei DB-Ausfall — sonst wirken Monitoring/Load-Balancer „kaputt“.)
 */
export async function GET() {
  let databaseConnected = false
  let dbCode: string | undefined
  let dbMessage: string | undefined

  try {
    await withTimeout(
      prisma.$queryRaw`SELECT 1`,
      DB_PROBE_TIMEOUT_MS,
      "Database probe"
    )
    databaseConnected = true
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : undefined
    const raw = err instanceof Error ? err.message : "DB probe failed"
    console.warn("[Health] DB not reachable:", raw)
    dbCode = code
    // Öffentlicher Endpunkt: keine Prisma-Interna ausgeben
    dbMessage = isPrismaConnectivityError(err)
      ? "Database unreachable or pool timeout."
      : code === "TIMEOUT"
        ? `Probe timed out after ${DB_PROBE_TIMEOUT_MS}ms.`
        : "Database check failed."
  }

  const status = databaseConnected ? "ok" : "degraded"
  return NextResponse.json({
    ok: true,
    status,
    app: "up",
    database: {
      connected: databaseConnected,
      ...(dbCode ? { code: dbCode } : {}),
      ...(dbMessage ? { message: dbMessage } : {}),
    },
  })
}
