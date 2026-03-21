import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/** Öffentlich: nur veröffentlichte News für die Startseite */
export async function GET() {
  try {
    const items = await prisma.homeNewsItem.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        body: true,
        linkUrl: true,
        linkLabel: true,
        publishedAt: true,
      },
    })
    return NextResponse.json({
      items: items.map((i) => ({
        ...i,
        publishedAt: i.publishedAt?.toISOString() ?? null,
      })),
    })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
