import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/health
 * Prüft DB-Verbindung. Nützlich zum Debuggen von 500-Fehlern.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: "connected" })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[Health] DB error:", message, stack)
    return NextResponse.json(
      {
        ok: false,
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack }),
      },
      { status: 500 }
    )
  }
}
