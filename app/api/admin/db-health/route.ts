import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const databaseUrl = process.env.DATABASE_URL
  const directUrl = process.env.DIRECT_URL

  let dbOk = false
  let dbError: { code?: string; message: string } | null = null
  try {
    // Lightweight connectivity test.
    await prisma.$queryRaw`SELECT 1 as ok`
    dbOk = true
  } catch (e: unknown) {
    const err: any = e
    dbError = { code: err?.code, message: err?.message ?? "DB test failed" }
  }

  return NextResponse.json({
    databaseUrl: summarizePostgresUrl(databaseUrl),
    directUrl: summarizePostgresUrl(directUrl),
    dbOk,
    dbError,
  })
}

