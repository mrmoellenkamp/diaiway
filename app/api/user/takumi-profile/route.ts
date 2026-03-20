import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ensureTaxonomySeeded } from "@/lib/taxonomy-server"

export const runtime = "nodejs"

/** GET — return the logged-in user's Expert profile (if any) */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    await ensureTaxonomySeeded()
    const expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      include: {
        categoryAssignments: { select: { categoryId: true } },
        specialtyAssignments: { select: { specialtyId: true } },
      },
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
      taxonomy: {
        categoryIds: expert.categoryAssignments.map((a) => a.categoryId),
        specialtyIds: expert.specialtyAssignments.map((a) => a.specialtyId),
        primaryCategoryId: expert.primaryCategoryId,
        primarySpecialtyId: expert.primarySpecialtyId,
      },
      bio: expert.bio,
      priceVideo15Min: Number(expert.priceVideo15Min),
      priceVoice15Min: Number(expert.priceVoice15Min),
      pricePerSession: expert.pricePerSession,
      responseTime: expert.responseTime,
      isLive: expert.isLive,
      hideOnlineStatus: expert.hideOnlineStatus ?? false,
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

async function applyTaxonomyFromLegacy(
  expertId: string,
  categorySlug: string,
  subcategory: string,
  categoryName: string,
) {
  const cat = await prisma.taxonomyCategory.findUnique({ where: { slug: categorySlug } })
  if (!cat) return

  await prisma.$transaction(async (tx) => {
    await tx.categoryOnExpert.deleteMany({ where: { expertId } })
    await tx.specialtyOnExpert.deleteMany({ where: { expertId } })
    await tx.categoryOnExpert.create({ data: { expertId, categoryId: cat.id } })
    let spec = await tx.taxonomySpecialty.findFirst({
      where: { categoryId: cat.id, name: subcategory.trim(), isActive: true },
    })
    if (!spec && subcategory.trim()) {
      const maxSort = await tx.taxonomySpecialty.aggregate({
        where: { categoryId: cat.id },
        _max: { sortOrder: true },
      })
      spec = await tx.taxonomySpecialty.create({
        data: {
          categoryId: cat.id,
          name: subcategory.trim(),
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
          isActive: true,
        },
      })
    }
    if (!spec) {
      spec = await tx.taxonomySpecialty.findFirst({
        where: { categoryId: cat.id, isActive: true },
        orderBy: { sortOrder: "asc" },
      })
    }
    if (spec) {
      await tx.specialtyOnExpert.create({ data: { expertId, specialtyId: spec.id } })
    }
    await tx.expert.update({
      where: { id: expertId },
      data: {
        primaryCategoryId: cat.id,
        primarySpecialtyId: spec?.id ?? null,
        categorySlug: cat.slug,
        categoryName: cat.name,
        subcategory: spec?.name ?? subcategory,
      },
    })
  })
}

/** PUT — create or update the logged-in user's Expert profile */
export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    await ensureTaxonomySeeded()

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
    if (body.bio !== undefined) data.bio = body.bio
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
    if (body.responseTime !== undefined) data.responseTime = body.responseTime
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl
    if (body.socialLinks !== undefined) data.socialLinks = body.socialLinks
    if (body.cancelPolicy !== undefined) data.cancelPolicy = body.cancelPolicy
    if (body.isLive !== undefined) data.isLive = !!body.isLive

    const hasNewTaxonomy =
      Array.isArray(body.categoryIds) &&
      Array.isArray(body.specialtyIds) &&
      typeof body.primaryCategoryId === "string" &&
      typeof body.primarySpecialtyId === "string"

    let categorySlugForCreate = "dienstleistungen"
    let categoryNameForCreate = "Dienstleistungen"
    let subcategoryForCreate = ""

    if (hasNewTaxonomy) {
      const categoryIds = [...new Set(body.categoryIds as string[])]
      const specialtyIds = [...new Set(body.specialtyIds as string[])]
      const primaryCategoryId = body.primaryCategoryId as string
      const primarySpecialtyId = body.primarySpecialtyId as string

      if (categoryIds.length < 1 || specialtyIds.length < 1) {
        return NextResponse.json(
          { error: "Mindestens eine Kategorie und ein Fachbereich erforderlich." },
          { status: 400 },
        )
      }

      if (!categoryIds.includes(primaryCategoryId)) {
        return NextResponse.json({ error: "Primärkategorie muss ausgewählt sein." }, { status: 400 })
      }

      const specialties = await prisma.taxonomySpecialty.findMany({
        where: { id: { in: specialtyIds }, isActive: true },
        include: { category: { select: { id: true } } },
      })
      if (specialties.length !== specialtyIds.length) {
        return NextResponse.json({ error: "Ungültige Fachbereich-IDs." }, { status: 400 })
      }
      for (const s of specialties) {
        if (!categoryIds.includes(s.categoryId)) {
          return NextResponse.json(
            { error: "Jeder Fachbereich muss zu einer gewählten Kategorie gehören." },
            { status: 400 },
          )
        }
      }

      const primarySpec = specialties.find((s) => s.id === primarySpecialtyId)
      if (!primarySpec || primarySpec.categoryId !== primaryCategoryId) {
        return NextResponse.json(
          { error: "Primärfachbereich muss zur Primärkategorie passen." },
          { status: 400 },
        )
      }

      const primaryCat = await prisma.taxonomyCategory.findUnique({
        where: { id: primaryCategoryId, isActive: true },
      })
      if (!primaryCat) {
        return NextResponse.json({ error: "Primärkategorie nicht gefunden." }, { status: 400 })
      }

      data.primaryCategoryId = primaryCategoryId
      data.primarySpecialtyId = primarySpecialtyId
      data.categorySlug = primaryCat.slug
      data.categoryName = primaryCat.name
      data.subcategory = primarySpec.name

      categorySlugForCreate = primaryCat.slug
      categoryNameForCreate = primaryCat.name
      subcategoryForCreate = primarySpec.name

      const expert = await prisma.expert.upsert({
        where: { userId: session.user.id },
        update: data,
        create: {
          userId: session.user.id,
          name: data.name as string,
          avatar: data.avatar as string,
          categorySlug: categorySlugForCreate,
          categoryName: categoryNameForCreate,
          subcategory: subcategoryForCreate,
          bio: (data.bio as string) ?? "",
          priceVideo15Min: (data.priceVideo15Min as number) ?? 1,
          priceVoice15Min: (data.priceVoice15Min as number) ?? 1,
          pricePerSession: (data.pricePerSession as number) ?? 0,
          email: "",
          rating: 0,
          reviewCount: 0,
          sessionCount: 0,
          isLive: false,
          isPro: false,
          verified: false,
          portfolio: [],
          joinedDate: new Date().toISOString().slice(0, 10),
          matchRate: 0,
          primaryCategoryId,
          primarySpecialtyId,
        },
      })

      await prisma.$transaction(async (tx) => {
        await tx.categoryOnExpert.deleteMany({ where: { expertId: expert.id } })
        await tx.specialtyOnExpert.deleteMany({ where: { expertId: expert.id } })
        for (const cid of categoryIds) {
          await tx.categoryOnExpert.create({ data: { expertId: expert.id, categoryId: cid } })
        }
        for (const sid of specialtyIds) {
          await tx.specialtyOnExpert.create({ data: { expertId: expert.id, specialtyId: sid } })
        }
      })

      await prisma.user.update({
        where: { id: session.user.id },
        data: { appRole: "takumi" },
      })

      revalidatePath("/categories")
      revalidatePath("/takumis")

      return NextResponse.json({
        success: true,
        id: expert.id,
        message: "Takumi-Profil gespeichert.",
      })
    }

    // Legacy / gemischt: categorySlug + subcategory
    if (body.categorySlug !== undefined) data.categorySlug = body.categorySlug
    if (body.categoryName !== undefined) data.categoryName = body.categoryName
    if (body.subcategory !== undefined) data.subcategory = body.subcategory

    const expert = await prisma.expert.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        name: data.name as string,
        avatar: data.avatar as string,
        categorySlug: (data.categorySlug as string) || "dienstleistungen",
        categoryName: (data.categoryName as string) || "Dienstleistungen",
        subcategory: (data.subcategory as string) || "",
        bio: (data.bio as string) ?? "",
        priceVideo15Min: (data.priceVideo15Min as number) ?? 1,
        priceVoice15Min: (data.priceVoice15Min as number) ?? 1,
        pricePerSession: (data.pricePerSession as number) ?? 0,
        email: "",
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

    const slug = (data.categorySlug as string) || expert.categorySlug
    const sub = (data.subcategory as string) ?? expert.subcategory
    const cname = (data.categoryName as string) || expert.categoryName
    await applyTaxonomyFromLegacy(expert.id, slug, sub, cname)

    await prisma.user.update({
      where: { id: session.user.id },
      data: { appRole: "takumi" },
    })

    revalidatePath("/categories")
    revalidatePath("/takumis")

    return NextResponse.json({
      success: true,
      id: expert.id,
      message: "Takumi-Profil gespeichert.",
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** PATCH — update isLive oder hideOnlineStatus (Takumi only) */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data: { isLive?: boolean; hideOnlineStatus?: boolean } = {}

    if (typeof body.isLive === "boolean") {
      if (body.isLive) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { emailConfirmedAt: true },
        })
        if (!user?.emailConfirmedAt) {
          return NextResponse.json(
            { error: "Bitte bestätige zuerst deine E-Mail-Adresse, um sichtbar zu werden." },
            { status: 403 },
          )
        }
      }
      data.isLive = body.isLive
    }
    if (typeof body.hideOnlineStatus === "boolean") {
      data.hideOnlineStatus = body.hideOnlineStatus
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "isLive oder hideOnlineStatus erforderlich." }, { status: 400 })
    }

    const expert = await prisma.expert.updateMany({
      where: { userId: session.user.id },
      data,
    })

    if (expert.count === 0) {
      return NextResponse.json({ error: "Kein Takumi-Profil gefunden." }, { status: 404 })
    }

    revalidatePath("/categories")
    revalidatePath("/takumis")

    return NextResponse.json({
      success: true,
      isLive: data.isLive ?? undefined,
      hideOnlineStatus: data.hideOnlineStatus ?? undefined,
      message:
        data.isLive !== undefined
          ? data.isLive
            ? "Du bist jetzt sichtbar."
            : "Du verbergst dich jetzt."
          : data.hideOnlineStatus
            ? "Status verborgen."
            : "Status wird angezeigt.",
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
