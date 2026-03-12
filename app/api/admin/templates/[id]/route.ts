import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/api-auth"

export const runtime = "nodejs"

/** PATCH — Übersetzung aktualisieren */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { language, subject, body: bodyText } = body as {
    language?: string
    subject?: string
    body?: string
  }

  if (!language) {
    return NextResponse.json({ error: "language erforderlich." }, { status: 400 })
  }

  const translation = await prisma.templateTranslation.findFirst({
    where: { templateId: id, language },
  })

  if (!translation) {
    const created = await prisma.templateTranslation.create({
      data: {
        templateId: id,
        language,
        subject: subject ?? "",
        body: (bodyText !== undefined && bodyText !== null) ? bodyText : "",
      },
    })
    return NextResponse.json(created)
  }

  const updated = await prisma.templateTranslation.update({
    where: { id: translation.id },
    data: {
      ...(subject !== undefined && { subject }),
      ...(bodyText !== undefined && { body: bodyText }),
    },
  })
  return NextResponse.json(updated)
}
