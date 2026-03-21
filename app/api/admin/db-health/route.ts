import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DB_PROBE_TIMEOUT_MS, withTimeout } from "@/lib/prisma-connectivity"

export const runtime = "nodejs"

function summarizePostgresUrl(url?: string) {
  if (!url) return null
  try {
    const u = new URL(url)
    return {
      scheme: u.protocol.replace(":", ""),
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, ""),
      sslmode: u.searchParams.get("sslmode"),
    }
  } catch {
    return { raw: true }
  }
}

export async function GET() {
  let session: Session | null
  try {
    session = await auth()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Auth failed"
    console.warn("[db-health] auth() error:", message)
    return NextResponse.json(
      {
        error: "Auth failed",
        hint: "Session/Auth could not be resolved (e.g. DB used during sign-in). Try again or check logs.",
        dbOk: false,
        dbError: { message },
      },
      { status: 503 }
    )
  }

  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const databaseUrl = process.env.DATABASE_URL
  const directUrl = process.env.DIRECT_URL

  let dbOk = false
  let dbError: { code?: string; message: string } | null = null
  try {
    // Lightweight connectivity test (bounded wait — avoids Vercel hang).
    await withTimeout(
      prisma.$queryRaw`SELECT 1 as ok`,
      DB_PROBE_TIMEOUT_MS,
      "Database probe"
    )
    dbOk = true
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: unknown }).code)
        : undefined
    const message = e instanceof Error ? e.message : "DB test failed"
    dbError = { code, message }
  }

  return NextResponse.json({
    databaseUrl: summarizePostgresUrl(databaseUrl),
    directUrl: summarizePostgresUrl(directUrl),
    dbOk,
    dbError,
  })
}

