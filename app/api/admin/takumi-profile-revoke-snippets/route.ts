import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"

export const runtime = "nodejs"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  // Legacy-Fix: erster Seed nutzte eine Nicht-CUID-ID und kann Prisma-Reads brechen.
  await prisma.$executeRaw`
    UPDATE "TakumiProfileRevokeSnippet"
    SET "id" = 'cm0000000000000000000000'
    WHERE "id" = 'takumi-revoke-default'
      AND NOT EXISTS (
        SELECT 1 FROM "TakumiProfileRevokeSnippet" t
        WHERE t."id" = 'cm0000000000000000000000'
      )
  `

  const snippets = await prisma.takumiProfileRevokeSnippet.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
  return NextResponse.json({ snippets })
}

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const text = typeof body.body === "string" ? body.body.trim() : ""
  if (!title || !text) {
    return NextResponse.json({ error: "Titel und Text sind erforderlich." }, { status: 400 })
  }

  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 999
  const created = await prisma.takumiProfileRevokeSnippet.create({
    data: {
      title,
      body: text,
      sortOrder,
      isActive: body.isActive !== false,
    },
  })
  return NextResponse.json({ snippet: created }, { status: 201 })
}
