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
      priceVideo15Min: Number(expert.priceVideo15Min),
      priceVoice15Min: Number(expert.priceVoice15Min),
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
    if (body.priceVideo15Min !== undefined) {
      const v = Number(body.priceVideo15Min)
      if (v < 1) return NextResponse.json({ error: "Video-Preis muss mindestens 1,00 € betragen." }, { status: 400 })
      data.priceVideo15Min = v
    }
    if (body.priceVoice15Min !== undefined) {
      const v = Number(body.priceVoice15Min)
      if (v < 1) return NextResponse.json({ error: "Voice-Preis muss mindestens 1,00 € betragen." }, { status: 400 })
      data.priceVoice15Min = v
    }
    if (body.pricePerSession !== undefined) data.pricePerSession = Number(body.pricePerSession) || 0
    if (body.responseTime !== undefined)    data.responseTime    = body.responseTime
    if (body.imageUrl !== undefined)        data.imageUrl        = body.imageUrl
    if (body.socialLinks !== undefined)     data.socialLinks     = body.socialLinks
    if (body.cancelPolicy !== undefined)    data.cancelPolicy    = body.cancelPolicy
    if (body.isLive !== undefined)          data.isLive          = !!body.isLive

    const expert = await prisma.expert.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        name: data.name as string,
        avatar: data.avatar as string,
        categorySlug:    (data.categorySlug    as string)  || "dienstleistungen",
        categoryName:    (data.categoryName    as string)  || "Dienstleistungen",
        subcategory:     (data.subcategory     as string)  || "",
        bio:             (data.bio             as string)  || "",
        priceVideo15Min: (data.priceVideo15Min as number) ?? 0,
        priceVoice15Min: (data.priceVoice15Min as number) ?? 0,
        pricePerSession: (data.pricePerSession as number) ?? 0,
        email:           "",
        rating: 0,
        reviewCount: 0,
        sessionCount: 0,
        isLive: false,
        isPro: false,
        verified: false,
        portfolio: [],
        joinedDate: new Date().toISOString().slice(0, 10),
        matchRate: 0,
      },
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

/** PATCH — update isLive (Takumi only) */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    if (typeof body.isLive !== "boolean") {
      return NextResponse.json({ error: "isLive muss true oder false sein." }, { status: 400 })
    }

    const expert = await prisma.expert.updateMany({
      where: { userId: session.user.id },
      data: { isLive: body.isLive },
    })

    if (expert.count === 0) {
      return NextResponse.json({ error: "Kein Takumi-Profil gefunden." }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      isLive: body.isLive,
      message: body.isLive ? "Du bist jetzt sichtbar." : "Du verbergst dich jetzt.",
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
