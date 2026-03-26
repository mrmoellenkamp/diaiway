import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/admin/experts?q=
 * Kurze Experten-Suche (Name/E-Mail) für Admin-Formulare (z. B. manuelle Review).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim()

  const experts = await prisma.expert.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    take: 40,
    orderBy: { name: "asc" },
    select: { id: true, userId: true, name: true, email: true, profileReviewStatus: true },
  })

  return NextResponse.json({ experts })
}
