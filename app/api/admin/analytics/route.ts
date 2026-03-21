import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function assertAdmin(session: { user?: unknown } | null) {
  const u = session?.user as { id?: string; role?: string } | undefined
  if (!u?.id || u.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/** Admin: aggregierte Nutzungsstatistik (Besucher, Verweildauer, Pfade) */
export async function GET(req: Request) {
  const session = await auth()
  const err = assertAdmin(session)
  if (err) return err

  const { searchParams } = new URL(req.url)
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days")) || 14))
  const since = new Date(Date.now() - days * 86_400_000)

  try {
    const [
      totalSessions,
      uniqueVisitors,
      loggedInSessions,
      aggRow,
      dailyRows,
      topPaths,
      bounceRow,
    ] = await Promise.all([
      prisma.siteAnalyticsSession.count({ where: { startedAt: { gte: since } } }),
      prisma.siteAnalyticsSession
        .groupBy({
          by: ["visitorId"],
          where: { startedAt: { gte: since } },
        })
        .then((r) => r.length),
      prisma.siteAnalyticsSession.count({
        where: { startedAt: { gte: since }, userId: { not: null } },
      }),
      prisma.$queryRaw<{ avg_engaged: number | null; avg_wall: number | null }[]>`
        SELECT
          AVG(s."engagedSeconds")::double precision AS avg_engaged,
          AVG(EXTRACT(EPOCH FROM (s."lastSeenAt" - s."startedAt")))::double precision AS avg_wall
        FROM "SiteAnalyticsSession" s
        WHERE s."startedAt" >= ${since}
      `,
      prisma.$queryRaw<{ day: Date; sessions: number; visitors: number }[]>`
        SELECT
          (date_trunc('day', s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS day,
          COUNT(*)::int AS sessions,
          COUNT(DISTINCT s."visitorId")::int AS visitors
        FROM "SiteAnalyticsSession" s
        WHERE s."startedAt" >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<{ path: string; views: number; sessions: number }[]>`
        SELECT
          p."path" AS path,
          COUNT(*)::int AS views,
          COUNT(DISTINCT p."sessionId")::int AS sessions
        FROM "SiteAnalyticsPageView" p
        INNER JOIN "SiteAnalyticsSession" s ON s."id" = p."sessionId"
        WHERE s."startedAt" >= ${since}
        GROUP BY p."path"
        ORDER BY views DESC
        LIMIT 30
      `,
      prisma.$queryRaw<{ single_page_sessions: number }[]>`
        SELECT COUNT(*)::int AS single_page_sessions
        FROM "SiteAnalyticsSession" s
        WHERE s."startedAt" >= ${since}
          AND (
            SELECT COUNT(*) FROM "SiteAnalyticsPageView" pv WHERE pv."sessionId" = s."id"
          ) <= 1
      `,
    ])

    const avgEngagedSeconds = aggRow[0]?.avg_engaged ?? 0
    const avgWallSeconds = aggRow[0]?.avg_wall ?? 0
    const singlePageSessions = bounceRow[0]?.single_page_sessions ?? 0
    const bounceRatePct =
      totalSessions > 0 ? Math.round((singlePageSessions / totalSessions) * 1000) / 10 : 0

    const byDay = dailyRows.map((r) => ({
      day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
      sessions: r.sessions,
      visitors: r.visitors,
    }))

    return NextResponse.json({
      range: { days, since: since.toISOString() },
      summary: {
        totalSessions,
        uniqueVisitors,
        loggedInSessions,
        anonymousSessions: totalSessions - loggedInSessions,
        avgEngagedSeconds: Math.round(avgEngagedSeconds * 10) / 10,
        avgWallSeconds: Math.round(avgWallSeconds * 10) / 10,
        bounceRatePct,
        singlePageSessions,
      },
      byDay,
      topPaths: topPaths.map((r) => ({
        path: r.path,
        views: r.views,
        sessions: r.sessions,
      })),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const missing =
      /does not exist|relation|Unknown|SiteAnalyticsSession|P20[0-9]{2}/i.test(msg)
    if (missing) {
      return NextResponse.json({
        degraded: true,
        degradedReason:
          "Analytics-Tabellen fehlen. Bitte `npm run db:migrate:deploy` ausführen und Prisma Client neu generieren.",
        range: { days, since: since.toISOString() },
        summary: {
          totalSessions: 0,
          uniqueVisitors: 0,
          loggedInSessions: 0,
          anonymousSessions: 0,
          avgEngagedSeconds: 0,
          avgWallSeconds: 0,
          bounceRatePct: 0,
          singlePageSessions: 0,
        },
        byDay: [] as { day: string; sessions: number; visitors: number }[],
        topPaths: [] as { path: string; views: number; sessions: number }[],
      })
    }
    console.error("[admin/analytics]", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
