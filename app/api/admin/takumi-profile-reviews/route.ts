import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/api-auth"
import { apiHandler } from "@/lib/api-handler"
import { TAKUMI_PROFILE_REJECTION_STANDARD_DE } from "@/lib/takumi-profile-moderation"

export const runtime = "nodejs"

/** GET — Takumi-Profile mit Status pending_review */
export const GET = apiHandler(async () => {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response

  const rows = await prisma.expert.findMany({
    where: { profileReviewStatus: "pending_review", userId: { not: null } },
    include: {
      user: { select: { id: true, name: true, email: true, username: true, image: true } },
    },
    orderBy: [{ profileSubmittedAt: "asc" }, { updatedAt: "asc" }],
  })

  return NextResponse.json({
    items: rows.map((e) => ({
      expertId: e.id,
      userId: e.userId,
      submittedAt: e.profileSubmittedAt?.toISOString() ?? null,
      name: e.name,
      categoryName: e.categoryName,
      subcategory: e.subcategory,
      bio: e.bio,
      bioLive: e.bioLive,
      imageUrl: e.imageUrl,
      user: e.user,
    })),
  })
})

/** PATCH — { expertId, action: "approve" | "reject", reason?: string } */
export const PATCH = apiHandler(async (req: NextRequest) => {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response
  const adminId = authResult.session.user.id

  let body: { expertId?: string; action?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 })
  }

  const expertId = typeof body.expertId === "string" ? body.expertId : ""
  if (!expertId) {
    return NextResponse.json({ error: "expertId erforderlich." }, { status: 400 })
  }

  const expert = await prisma.expert.findFirst({
    where: { id: expertId, userId: { not: null } },
  })
  if (!expert) {
    return NextResponse.json({ error: "Expert nicht gefunden." }, { status: 404 })
  }
  if (expert.profileReviewStatus !== "pending_review") {
    return NextResponse.json({ error: "Dieses Profil steht nicht zur Prüfung an." }, { status: 400 })
  }

  const action = body.action
  if (action === "approve") {
    await prisma.expert.update({
      where: { id: expert.id },
      data: {
        profileReviewStatus: "approved",
        bioLive: expert.bio,
        profileReviewedAt: new Date(),
        profileReviewedByUserId: adminId,
        profileRejectionReason: null,
        profileRejectedAt: null,
      },
    })
  } else if (action === "reject") {
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : TAKUMI_PROFILE_REJECTION_STANDARD_DE
    await prisma.expert.update({
      where: { id: expert.id },
      data: {
        profileReviewStatus: "rejected",
        profileRejectionReason: reason,
        profileRejectedAt: new Date(),
        profileReviewedAt: new Date(),
        profileReviewedByUserId: adminId,
        isLive: false,
      },
    })
  } else {
    return NextResponse.json({ error: "action muss approve oder reject sein." }, { status: 400 })
  }

  revalidatePath("/takumis")
  revalidatePath("/categories")
  return NextResponse.json({ ok: true })
})
