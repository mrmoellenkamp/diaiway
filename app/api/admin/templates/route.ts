import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/api-auth"
import { createSystemWaymail } from "@/lib/system-waymail"
import {
  getRenderedTemplate,
  getRenderedTemplateRaw,
  STANDARD_VARIABLES,
  BOOKING_VARIABLES,
  GUEST_CALL_VARIABLES,
} from "@/lib/template-service"
import { seedCommunicationTemplates } from "@/lib/seed-templates"
import { transporter, smtpFrom, emailWrapper } from "@/lib/email"

export const runtime = "nodejs"

const GUEST_CALL_SLUGS = ["guest-call-invite", "guest-call-confirm-takumi"]

/** GET — Liste aller Templates */
export async function GET() {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response

  const templates = await prisma.communicationTemplate.findMany({
    include: { translations: true },
    orderBy: { slug: "asc" },
  })
  return NextResponse.json({
    templates,
    standardVariables: STANDARD_VARIABLES,
    bookingVariables: BOOKING_VARIABLES,
    guestCallVariables: GUEST_CALL_VARIABLES,
  })
}

/** POST — Seed-Templates oder Test */
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response
  const { session } = authResult

  const body = await req.json().catch(() => ({}))
  const { action, slug, language, recipientUserId, testEmail } = body as {
    action?: "seed" | "test"
    slug?: string
    language?: string
    recipientUserId?: string
    testEmail?: string  // for guest-call templates: send real e-mail here
  }

  if (action === "seed") {
    await seedCommunicationTemplates()
    return NextResponse.json({ ok: true, message: "Templates geseedet." })
  }

  if (action === "test" && slug && language) {
    const lang = language as "de" | "en" | "es"

    // ── Gast-Call-Templates: render raw + send real e-mail ─────────────────
    if (GUEST_CALL_SLUGS.includes(slug)) {
      const to = testEmail?.trim() || session.user.email || ""
      if (!to) {
        return NextResponse.json({ error: "Bitte Test-E-Mail-Adresse angeben." }, { status: 400 })
      }
      const isInvite = slug === "guest-call-invite"
      const rendered = await getRenderedTemplateRaw(slug, lang, {
        takumi_name: "Max Mustermann (Test-Takumi)",
        guest_email: "gast@beispiel.de",
        date: "15.04.2026",
        start_time: "10:00",
        end_time: "11:00",
        price: "120,00",
        call_link: `${process.env.NEXTAUTH_URL || "https://diaiway.com"}/call/test-token-preview`,
        host_message: isInvite ? "Ich freue mich auf unser Gespräch!" : "",
      })
      if (!rendered) {
        return NextResponse.json({ error: "Template nicht gefunden oder keine Übersetzung." }, { status: 404 })
      }
      const bodyHtml = rendered.body
        .split(/\n\n+/)
        .map((p: string) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#78716c;">${p.replace(/\n/g, "<br/>")}</p>`)
        .join("")
      try {
        await transporter.sendMail({
          from: smtpFrom,
          to,
          subject: `[Test] ${rendered.subject}`,
          html: emailWrapper(rendered.subject, `<p style="margin:0 0 16px;padding:8px 12px;background:#fef9c3;border-radius:8px;font-size:12px;color:#78716c;">⚠ Test-E-Mail vom Admin-Panel</p>${bodyHtml}`),
        })
        return NextResponse.json({ ok: true, sentTo: to, mode: "email" })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: `E-Mail-Versand fehlgeschlagen: ${msg}` }, { status: 500 })
      }
    }

    // ── Standard-Templates: Waymail an registrierten User ──────────────────
    if (!recipientUserId) {
      return NextResponse.json({ error: "recipientUserId fehlt für Standard-Templates." }, { status: 400 })
    }
    const rendered = await getRenderedTemplate(slug, lang, {
      senderUserId: session.user.id,
      recipientUserId,
      extraVariables: {
        booking_date: "15.04.2026",
        booking_time: "10:00–11:00 Uhr",
        service_name: "Test-Experte",
      },
    })
    if (!rendered) {
      return NextResponse.json({ error: "Template nicht gefunden oder keine Übersetzung." }, { status: 404 })
    }
    const waymail = await createSystemWaymail({
      recipientId: recipientUserId,
      subject: `[Test] ${rendered.subject}`,
      body: `[Diese Waymail wurde als Test vom Admin gesendet]\n\n${rendered.body}`,
    })
    return NextResponse.json({ ok: true, waymailId: waymail.id, mode: "waymail" })
  }

  return NextResponse.json({ error: "Unbekannte Aktion oder fehlende Parameter." }, { status: 400 })
}
