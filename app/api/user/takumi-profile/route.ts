import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/** GET — return the logged-in user's Expert profile (if any) */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
    })
    if (!expert) return NextResponse.json({ exists: false })

    return NextResponse.json({
      exists: true,
      id: expert.id,
      name: expert.name,
      avatar: expert.avatar,
      categorySlug: expert.categorySlug,
      categoryName: expert.categoryName,
      subcategory: expert.subcategory,
      bio: expert.bio,
      pricePerSession: expert.pricePerSession,
      responseTime: expert.responseTime,
      isLive: expert.isLive,
      isPro: expert.isPro,
      verified: expert.verified,
      portfolio: expert.portfolio,
      imageUrl: expert.imageUrl,
      socialLinks: expert.socialLinks ?? {},
      cancelPolicy: expert.cancelPolicy ?? { freeHours: 24, feePercent: 0 },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** PUT — create or update the logged-in user's Expert profile */
export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    })
    const expertName: string = body.name || user?.name || "Takumi"
    const avatar = expertName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()

    const data: Record<string, unknown> = { userId: session.user.id, name: expertName, avatar }
    if (body.categorySlug !== undefined)    data.categorySlug    = body.categorySlug
    if (body.categoryName !== undefined)    data.categoryName    = body.categoryName
    if (body.subcategory !== undefined)     data.subcategory     = body.subcategory
    if (body.bio !== undefined)             data.bio             = body.bio
    if (body.pricePerSession !== undefined) data.pricePerSession = Number(body.pricePerSession) || 0
    if (body.responseTime !== undefined)    data.responseTime    = body.responseTime
    if (body.imageUrl !== undefined)        data.imageUrl        = body.imageUrl
    if (body.socialLinks !== undefined)     data.socialLinks     = body.socialLinks
    if (body.cancelPolicy !== undefined)    data.cancelPolicy    = body.cancelPolicy

    const expert = await prisma.expert.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        // Required fields with safe fallbacks for first-save
        categorySlug:    (data.categorySlug    as string)  || "dienstleistungen",
        categoryName:    (data.categoryName    as string)  || "Dienstleistungen",
        subcategory:     (data.subcategory     as string)  || "",
        bio:             (data.bio             as string)  || "",
        pricePerSession: (data.pricePerSession as number)  || 0,
        email:           "",
        ...data,
        rating: 0,
        reviewCount: 0,
        sessionCount: 0,
        isLive: false,
        isPro: false,
        verified: false,
        portfolio: [],
        joinedDate: new Date().toISOString().slice(0, 10),
        matchRate: 0,
      } as Parameters<typeof prisma.expert.create>[0]["data"],
    })

    // Ensure user's appRole is set to takumi
    await prisma.user.update({
      where: { id: session.user.id },
      data: { appRole: "takumi" },
    })

    return NextResponse.json({
      success: true,
      id: expert.id,
      message: "Takumi-Profil gespeichert.",
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
