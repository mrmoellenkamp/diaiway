import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import type { Prisma, TakumiProfileReviewStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ensureTaxonomySeeded, isTaxonomySchemaAvailable } from "@/lib/taxonomy-server"
import { TAKUMI_ONLINE_PRESENCE_MS } from "@/lib/expert-to-takumi"
import { validateNoContactLeak } from "@/lib/contact-leak-validation"
import { expertPublicBio } from "@/lib/expert-public-bio"
import { computeProfileSubmitState } from "@/lib/takumi-profile-moderation"

type ExpertWithTaxonomyAssignments = Prisma.ExpertGetPayload<{
  include: {
    categoryAssignments: { select: { categoryId: true } }
    specialtyAssignments: { select: { specialtyId: true } }
  }
}>

export const runtime = "nodejs"

/** GET — return the logged-in user's Expert profile (if any) */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const taxonomyReady = await isTaxonomySchemaAvailable()
    if (taxonomyReady) {
      await ensureTaxonomySeeded()
    }

    const expert = taxonomyReady
      ? await prisma.expert.findUnique({
          where: { userId: session.user.id },
          include: {
            categoryAssignments: { select: { categoryId: true } },
            specialtyAssignments: { select: { specialtyId: true } },
          },
        })
      : await prisma.expert.findUnique({
          where: { userId: session.user.id },
        })
    if (!expert) return NextResponse.json({ exists: false })

    const publicBio = expertPublicBio(expert)
    const previewShowsPublicVsPendingHint =
      expert.profileReviewStatus === "pending_review" &&
      expert.bioLive.trim().length > 0 &&
      expert.bio.trim() !== expert.bioLive.trim()

    const now = Date.now()
    const lastSeenMs = expert.lastSeenAt?.getTime()
    const recentPresence =
      lastSeenMs != null && now - lastSeenMs < TAKUMI_ONLINE_PRESENCE_MS
    const appearsOnlineToOthers = recentPresence && !(expert.hideOnlineStatus ?? false)

    const categoryIds = taxonomyReady
      ? (expert as ExpertWithTaxonomyAssignments).categoryAssignments.map((a) => a.categoryId)
      : []
    const specialtyIds = taxonomyReady
      ? (expert as ExpertWithTaxonomyAssignments).specialtyAssignments.map((a) => a.specialtyId)
      : []

    return NextResponse.json({
      exists: true,
      id: expert.id,
      name: expert.name,
      avatar: expert.avatar,
      categorySlug: expert.categorySlug,
      categoryName: expert.categoryName,
      subcategory: expert.subcategory,
      taxonomy: {
        categoryIds,
        specialtyIds,
        primaryCategoryId: expert.primaryCategoryId,
        primarySpecialtyId: expert.primarySpecialtyId,
      },
      bio: expert.bio,
      bioLive: expert.bioLive,
      publicBio,
      profileReviewStatus: expert.profileReviewStatus,
      profileRejectionReason: expert.profileRejectionReason,
      profileSubmittedAt: expert.profileSubmittedAt?.toISOString() ?? null,
      previewShowsPublicVsPendingHint,
      priceVideo15Min: Number(expert.priceVideo15Min),
      priceVoice15Min: Number(expert.priceVoice15Min),
      pricePerSession: expert.pricePerSession,
      responseTime: expert.responseTime,
      isLive: expert.isLive,
      lastSeenAt: expert.lastSeenAt?.toISOString() ?? null,
      liveStatus: expert.liveStatus ?? "offline",
      appearsOnlineToOthers,
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
  _categoryName: string,
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

function moderationExtras(
  existing: {
    profileReviewStatus: TakumiProfileReviewStatus
    bioLive: string
    bio: string
  } | null,
  nextBio: string,
  submitForReview: boolean,
): { update: Record<string, unknown>; create: Record<string, unknown> } {
  if (!submitForReview) {
    if (!existing) {
      return {
        update: {},
        create: { profileReviewStatus: "draft" as const, bioLive: "" },
      }
    }
    return { update: {}, create: {} }
  }
  const submit = computeProfileSubmitState({
    previousStatus: existing?.profileReviewStatus ?? null,
    previousBioLive: existing?.bioLive ?? "",
    nextBio,
  })
  const update: Record<string, unknown> = {
    profileReviewStatus: submit.profileReviewStatus,
  }
  const create: Record<string, unknown> = {
    profileReviewStatus: submit.profileReviewStatus,
    bioLive: submit.syncBioLiveToBio ? nextBio : "",
  }
  if (submit.profileReviewStatus === "pending_review") {
    const now = new Date()
    update.profileSubmittedAt = now
    update.profileRejectionReason = null
    update.profileRejectedAt = null
    create.profileSubmittedAt = now
    create.profileRejectionReason = null
    create.profileRejectedAt = null
  }
  if (submit.syncBioLiveToBio) {
    update.bioLive = nextBio
  }
  return { update, create }
}

/** PUT — create or update the logged-in user's Expert profile */
export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const submitForReview = body.submitForReview === true
    const taxonomyReady = await isTaxonomySchemaAvailable()
    if (taxonomyReady) {
      await ensureTaxonomySeeded()
    }

    const existing = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      select: { id: true, bio: true, bioLive: true, profileReviewStatus: true },
    })

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

    const nextBio = body.bio !== undefined ? String(body.bio) : (existing?.bio ?? "")
    const leak = validateNoContactLeak(nextBio, "Beschreibung")
    if (!leak.ok) {
      return NextResponse.json({ error: leak.message }, { status: 400 })
    }

    const mod = moderationExtras(
      existing
        ? {
            profileReviewStatus: existing.profileReviewStatus,
            bioLive: existing.bioLive,
            bio: existing.bio,
          }
        : null,
      nextBio,
      submitForReview,
    )

    const data: Record<string, unknown> = { name: expertName, avatar, bio: nextBio }
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

    const hasNewTaxonomy =
      Array.isArray(body.categoryIds) &&
      Array.isArray(body.specialtyIds) &&
      typeof body.primaryCategoryId === "string" &&
      typeof body.primarySpecialtyId === "string"

    let categorySlugForCreate = "dienstleistungen"
    let categoryNameForCreate = "Dienstleistungen"
    let subcategoryForCreate = ""

    if (hasNewTaxonomy) {
      if (!taxonomyReady) {
        return NextResponse.json(
          {
            error:
              "Die Kategorie-Datenbank ist auf diesem Server noch nicht eingerichtet. Bitte Migration ausführen: npx prisma migrate deploy (Ordner 20260320120000_taxonomy_categories). Bis dahin kannst du das Profil nur mit der einfachen Kategorieauswahl (Slug/Text) speichern.",
            code: "TAXONOMY_SCHEMA_MISSING",
          },
          { status: 503 },
        )
      }

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
        update: { ...data, ...mod.update },
        create: {
          userId: session.user.id,
          name: data.name as string,
          avatar: data.avatar as string,
          categorySlug: categorySlugForCreate,
          categoryName: categoryNameForCreate,
          subcategory: subcategoryForCreate,
          bio: nextBio,
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
          ...mod.create,
        },
      })

      if (expert.profileReviewStatus !== "approved") {
        await prisma.expert.update({
          where: { id: expert.id },
          data: { isLive: false },
        })
      }

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

      const msg =
        !submitForReview
          ? "Entwurf gespeichert."
          : expert.profileReviewStatus === "pending_review"
            ? "Profil zur Prüfung eingereicht."
            : "Takumi-Profil gespeichert."
      return NextResponse.json({
        success: true,
        id: expert.id,
        profileReviewStatus: expert.profileReviewStatus,
        message: msg,
      })
    }

    // Legacy / gemischt: categorySlug + subcategory
    if (body.categorySlug !== undefined) data.categorySlug = body.categorySlug
    if (body.categoryName !== undefined) data.categoryName = body.categoryName
    if (body.subcategory !== undefined) data.subcategory = body.subcategory

    const expert = await prisma.expert.upsert({
      where: { userId: session.user.id },
      update: { ...data, ...mod.update },
      create: {
        userId: session.user.id,
        name: data.name as string,
        avatar: data.avatar as string,
        categorySlug: (data.categorySlug as string) || "dienstleistungen",
        categoryName: (data.categoryName as string) || "Dienstleistungen",
        subcategory: (data.subcategory as string) || "",
        bio: nextBio,
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
        ...mod.create,
      },
    })

    if (expert.profileReviewStatus !== "approved") {
      await prisma.expert.update({
        where: { id: expert.id },
        data: { isLive: false },
      })
    }

    const slug = (data.categorySlug as string) || expert.categorySlug
    const sub = (data.subcategory as string) ?? expert.subcategory
    const cname = (data.categoryName as string) || expert.categoryName
    if (taxonomyReady) {
      await applyTaxonomyFromLegacy(expert.id, slug, sub, cname)
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { appRole: "takumi" },
    })

    revalidatePath("/categories")
    revalidatePath("/takumis")

    const msg =
      !submitForReview
        ? "Entwurf gespeichert."
        : expert.profileReviewStatus === "pending_review"
          ? "Profil zur Prüfung eingereicht."
          : "Takumi-Profil gespeichert."
    return NextResponse.json({
      success: true,
      id: expert.id,
      profileReviewStatus: expert.profileReviewStatus,
      message: msg,
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
    const data: { isLive?: boolean; hideOnlineStatus?: boolean; cancelPolicy?: Prisma.InputJsonValue } = {}

    if (typeof body.isLive === "boolean") {
      if (body.isLive) {
        const expertRow = await prisma.expert.findUnique({
          where: { userId: session.user.id },
          select: { profileReviewStatus: true },
        })
        if (expertRow?.profileReviewStatus !== "approved") {
          return NextResponse.json(
            {
              error:
                "Dein Profil ist noch nicht freigegeben. Nach der Freigabe kannst du dich in der Expertenliste sichtbar schalten.",
            },
            { status: 403 },
          )
        }
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
    if (body.cancelPolicy !== undefined && body.cancelPolicy !== null && typeof body.cancelPolicy === "object") {
      data.cancelPolicy = body.cancelPolicy as Prisma.InputJsonValue
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine unterstützten Felder zum Aktualisieren." }, { status: 400 })
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
