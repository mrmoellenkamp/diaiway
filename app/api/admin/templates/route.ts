import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/api-auth"
import { createSystemWaymail } from "@/lib/system-waymail"
import { getRenderedTemplate, STANDARD_VARIABLES, BOOKING_VARIABLES } from "@/lib/template-service"
import { seedCommunicationTemplates } from "@/lib/seed-templates"

export const runtime = "nodejs"

/** GET — Liste aller Templates */
export async function GET() {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response

  const templates = await prisma.communicationTemplate.findMany({
    include: {
      translations: true,
    },
    orderBy: { slug: "asc" },
  })
  return NextResponse.json({
    templates,
    standardVariables: STANDARD_VARIABLES,
    bookingVariables: BOOKING_VARIABLES,
  })
}

/** POST — Seed-Templates oder Test-Waymail */
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response
  const { session } = authResult

  const body = await req.json().catch(() => ({}))
  const { action, slug, language, recipientUserId } = body as {
    action?: "seed" | "test"
    slug?: string
    language?: string
    recipientUserId?: string
  }

  if (action === "seed") {
    await seedCommunicationTemplates()
    return NextResponse.json({ ok: true, message: "Templates ges seeded." })
  }

  if (action === "test" && slug && language && recipientUserId) {
    const rendered = await getRenderedTemplate(slug, language as "de" | "en" | "es", {
      senderUserId: session.user.id,
      recipientUserId,
      extraVariables: {
        booking_date: "15.03.2025",
        booking_time: "10:00–10:30 Uhr",
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
    return NextResponse.json({ ok: true, waymailId: waymail.id })
  }

  return NextResponse.json({ error: "Unbekannte Aktion oder fehlende Parameter." }, { status: 400 })
}
