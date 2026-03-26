import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"
import { TAKUMI_PROFILE_REJECTION_STANDARD_DE } from "@/lib/takumi-profile-moderation"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await req.json().catch(() => ({}))
  const expertId = typeof body.expertId === "string" ? body.expertId : ""
  const snippetId = typeof body.snippetId === "string" ? body.snippetId : ""
  const customMessage = typeof body.customMessage === "string" ? body.customMessage.trim() : ""
  if (!expertId) {
    return NextResponse.json({ error: "expertId erforderlich." }, { status: 400 })
  }

  const expert = await prisma.expert.findUnique({
    where: { id: expertId },
    select: { id: true, userId: true, name: true, profileReviewStatus: true },
  })
  if (!expert?.userId) {
    return NextResponse.json({ error: "Takumi-Profil nicht gefunden." }, { status: 404 })
  }
  if (expert.profileReviewStatus !== "approved") {
    return NextResponse.json(
      { error: "Freigabe kann nur bei aktuell freigegebenen Profilen entzogen werden." },
      { status: 400 },
    )
  }

  let message = customMessage
  if (!message && snippetId) {
    const snippet = await prisma.takumiProfileRevokeSnippet.findUnique({
      where: { id: snippetId },
      select: { body: true },
    })
    message = snippet?.body?.trim() ?? ""
  }
  if (!message) {
    message = TAKUMI_PROFILE_REJECTION_STANDARD_DE
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.expert.update({
      where: { id: expert.id },
      data: {
        profileReviewStatus: "rejected",
        profileRejectionReason: message,
        profileRejectedAt: now,
        profileReviewedAt: now,
        profileReviewedByUserId: admin.userId,
        isLive: false,
        liveStatus: "offline",
      },
    })

    await tx.notification.create({
      data: {
        userId: expert.userId!,
        type: "profile_review",
        title: "Takumi-Profil: Freigabe entzogen",
        body: message,
      },
    })
  })

  revalidatePath("/takumis")
  revalidatePath("/categories")

  return NextResponse.json({ ok: true })
}
