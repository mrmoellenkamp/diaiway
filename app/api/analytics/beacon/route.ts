import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  isLikelyBotUserAgent,
  isValidAnalyticsVisitorId,
  sanitizeAnalyticsPath,
} from "@/lib/site-analytics"

export const runtime = "nodejs"

type Body = {
  action?: string
  visitorId?: string
  path?: string
  sessionId?: string
  previousPath?: string | null
  previousDurationSec?: number
  seconds?: number
  referrer?: string
}

/** page/pulse: nur mit passender visitorId (wie bei init), sonst keine Fremdsession-Updates */
function assertVisitorMatchesSession(
  bodyVisitorId: unknown,
  sessionVisitorId: string
): NextResponse | null {
  if (!isValidAnalyticsVisitorId(bodyVisitorId)) {
    return NextResponse.json({ error: "visitorId" }, { status: 400 })
  }
  if (bodyVisitorId !== sessionVisitorId) {
    return NextResponse.json({ error: "unknown session" }, { status: 404 })
  }
  return null
}

async function resolveUserId(): Promise<string | null> {
  const s = await auth()
  const id = s?.user?.id
  return typeof id === "string" ? id : null
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ua = req.headers.get("user-agent") ?? ""
  if (isLikelyBotUserAgent(ua)) {
    return NextResponse.json({ ok: true, ignored: "bot" })
  }

  const action = body.action
  const userId = await resolveUserId()

  try {
    if (action === "init") {
      const visitorId = body.visitorId
      if (!isValidAnalyticsVisitorId(visitorId)) {
        return NextResponse.json({ error: "visitorId" }, { status: 400 })
      }
      const path = sanitizeAnalyticsPath(body.path)
      if (!path) {
        return NextResponse.json({ error: "path" }, { status: 400 })
      }
      const ref =
        typeof body.referrer === "string" && body.referrer.length <= 512 ? body.referrer : null

      const session = await prisma.siteAnalyticsSession.create({
        data: {
          visitorId,
          userId,
          entryPath: path,
          referrer: ref,
          userAgent: ua.slice(0, 400) || null,
          lastSeenAt: new Date(),
          pageViews: {
            create: { path, durationSeconds: 0 },
          },
        },
      })

      return NextResponse.json({ ok: true, sessionId: session.id })
    }

    if (action === "page") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId" }, { status: 400 })
      }
      const path = sanitizeAnalyticsPath(body.path)
      if (!path) {
        return NextResponse.json({ error: "path" }, { status: 400 })
      }

      const session = await prisma.siteAnalyticsSession.findUnique({
        where: { id: sessionId },
        include: { pageViews: { orderBy: { enteredAt: "desc" }, take: 1 } },
      })
      if (!session) {
        return NextResponse.json({ error: "unknown session" }, { status: 404 })
      }

      const now = new Date()
      const prevPath = body.previousPath != null ? sanitizeAnalyticsPath(body.previousPath) : null
      const prevDur =
        typeof body.previousDurationSec === "number" && Number.isFinite(body.previousDurationSec)
          ? Math.max(0, Math.min(Math.floor(body.previousDurationSec), 86_400))
          : null

      if (prevPath && prevDur != null) {
        const hit = await prisma.siteAnalyticsPageView.findFirst({
          where: { sessionId, path: prevPath },
          orderBy: { enteredAt: "desc" },
        })
        if (hit) {
          await prisma.siteAnalyticsPageView.update({
            where: { id: hit.id },
            data: { durationSeconds: prevDur },
          })
        }
      }

      const latest = await prisma.siteAnalyticsPageView.findFirst({
        where: { sessionId },
        orderBy: { enteredAt: "desc" },
      })

      if (!latest || latest.path !== path) {
        await prisma.siteAnalyticsPageView.create({
          data: { sessionId, path, durationSeconds: 0 },
        })
      }

      await prisma.siteAnalyticsSession.update({
        where: { id: sessionId },
        data: {
          lastSeenAt: now,
          ...(userId && !session.userId ? { userId } : {}),
        },
      })

      return NextResponse.json({ ok: true })
    }

    if (action === "pulse") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId" }, { status: 400 })
      }
      const rawSec =
        typeof body.seconds === "number" && Number.isFinite(body.seconds)
          ? Math.floor(body.seconds)
          : 0
      const sec = Math.max(0, Math.min(rawSec, 45))

      const session = await prisma.siteAnalyticsSession.findUnique({ where: { id: sessionId } })
      if (!session) {
        return NextResponse.json({ error: "unknown session" }, { status: 404 })
      }
      const vidErr = assertVisitorMatchesSession(body.visitorId, session.visitorId)
      if (vidErr) return vidErr

      await prisma.siteAnalyticsSession.update({
        where: { id: sessionId },
        data: {
          engagedSeconds: { increment: sec },
          lastSeenAt: new Date(),
          ...(userId && !session.userId ? { userId } : {}),
        },
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "action" }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/does not exist|Unknown model|SiteAnalyticsSession/i.test(msg)) {
      return NextResponse.json({ ok: true, degraded: true })
    }
    console.error("[analytics/beacon]", e)
    return NextResponse.json({ error: "server" }, { status: 500 })
  }
}
