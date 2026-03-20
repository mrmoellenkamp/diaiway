import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return { error: "Nicht autorisiert." as const, status: 401 as const }
  }
  return { session }
}

/**
 * GET /api/admin/users/[id]/profile
 * Vollständiges Profil inkl. Expert, Shugyo-Projekte, Takumi-Portfolio, Availability.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 })

  try {
    const [user, expert, shugyoProjects, takumiPortfolio, availability] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          appRole: true,
          status: true,
          isBanned: true,
          skillLevel: true,
          balance: true,
          pendingBalance: true,
          refundPreference: true,
          invoiceData: true,
          languages: true,
          customerNumber: true,
          isVerified: true,
          verificationSource: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.expert.findUnique({
        where: { userId: id },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          categorySlug: true,
          categoryName: true,
          subcategory: true,
          bio: true,
          rating: true,
          reviewCount: true,
          sessionCount: true,
          responseTime: true,
          priceVideo15Min: true,
          priceVoice15Min: true,
          pricePerSession: true,
          isLive: true,
          lastSeenAt: true,
          liveStatus: true,
          isPro: true,
          verified: true,
          portfolio: true,
          joinedDate: true,
          imageUrl: true,
          matchRate: true,
          socialLinks: true,
          cancelPolicy: true,
          stripeConnectAccountId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.shugyoProject.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, description: true, imageUrl: true, createdAt: true },
      }),
      prisma.takumiPortfolioProject.findMany({
        where: { userId: id },
        orderBy: [{ completionDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          category: true,
          completionDate: true,
          createdAt: true,
        },
      }),
      prisma.availability.findUnique({
        where: { userId: id },
        select: { slots: true, yearlyRules: true, exceptions: true, instantSlots: true },
      }),
    ])

    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    return NextResponse.json({
      user: {
        ...user,
        balance: user.balance ?? 0,
        pendingBalance: user.pendingBalance ?? 0,
      },
      expert: expert ? { ...expert } : null,
      shugyoProjects: shugyoProjects ?? [],
      takumiPortfolio: takumiPortfolio ?? [],
      availability: availability ?? null,
    })
  } catch (err) {
    console.error("[admin/users/profile] GET error:", err)
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/users/[id]/profile
 * Admin kann User, Expert, Projekte und Availability bearbeiten.
 * Body: { user?: {...}, expert?: {...}, shugyoProjects?: [{id?,title,description,imageUrl}], takumiPortfolio?: [...], availability?: {...} }
 * Projekte: id vorhanden = Update, id fehlt = Create. deleteShugyoIds / deleteTakumiIds = IDs zum Löschen.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 })

  let body: {
    user?: Record<string, unknown>
    expert?: Record<string, unknown>
    shugyoProjects?: Array<{ id?: string; title?: string; description?: string; imageUrl?: string }>
    takumiPortfolio?: Array<{
      id?: string
      title?: string
      description?: string
      imageUrl?: string
      category?: string
      completionDate?: string | null
    }>
    deleteShugyoIds?: string[]
    deleteTakumiIds?: string[]
    availability?: { slots?: unknown; yearlyRules?: unknown; exceptions?: unknown; instantSlots?: unknown }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (body.user && Object.keys(body.user).length > 0) {
        const existing = await tx.user.findUnique({
          where: { id },
          select: { email: true, isVerified: true },
        })
        const isAnonymized = existing?.email?.endsWith("@anonymized.local") ?? false

        const allowed = [
          "name", "email", "image", "role", "appRole", "status", "isBanned",
          "skillLevel", "refundPreference", "invoiceData", "languages", "isVerified", "username",
        ] as const
        const data: Record<string, unknown> = {}
        const { sanitizeInvoiceData } = await import("@/lib/security")
        for (const k of allowed) {
          if (body.user![k] === undefined) continue
          if (isAnonymized && (k === "username" || k === "isVerified")) continue
          if (k === "invoiceData") {
            const sanitized = sanitizeInvoiceData(body.user!.invoiceData)
            if (sanitized !== null) data[k] = sanitized
          } else if (k === "isVerified") {
            data.isVerified = !!body.user!.isVerified
            data.verificationSource = body.user!.isVerified ? "MANUAL" : "NONE"
          } else if (k === "languages") {
            const valid = ["de", "en", "es", "fr", "it"]
            const arr = Array.isArray(body.user!.languages) ? body.user!.languages : []
            data.languages = [...new Set(arr.filter((l: string) => valid.includes(String(l).toLowerCase())))]
          } else {
            data[k] = body.user![k] as unknown
          }
        }
        if (Object.keys(data).length > 0) {
          await tx.user.update({ where: { id }, data })
        }
      }

      const expertRow = await tx.expert.findUnique({ where: { userId: id } })

      if (body.expert && Object.keys(body.expert).length > 0 && expertRow) {
        const allowed = [
          "name", "email", "avatar", "categorySlug", "categoryName", "subcategory",
          "bio", "priceVideo15Min", "priceVoice15Min", "pricePerSession",
          "isLive", "liveStatus", "isPro", "verified", "responseTime",
          "socialLinks", "cancelPolicy", "imageUrl", "portfolio",
        ] as const
        const data: Record<string, unknown> = {}
        for (const k of allowed) {
          if (body.expert![k] !== undefined) data[k] = body.expert![k]
        }
        if (Object.keys(data).length > 0) {
          await tx.expert.update({ where: { id: expertRow.id }, data })
        }
      }

      if (body.deleteShugyoIds?.length) {
        await tx.shugyoProject.deleteMany({
          where: { id: { in: body.deleteShugyoIds }, userId: id },
        })
      }
      if (body.shugyoProjects?.length) {
        for (const p of body.shugyoProjects) {
          const title = typeof p.title === "string" ? p.title.trim() : ""
          if (!title && p.id) continue
          if (p.id) {
            await tx.shugyoProject.updateMany({
              where: { id: p.id, userId: id },
              data: {
                title: title || undefined,
                description: typeof p.description === "string" ? p.description : "",
                imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : "",
              },
            })
          } else if (title.length >= 2) {
            await tx.shugyoProject.create({
              data: {
                userId: id,
                title,
                description: typeof p.description === "string" ? p.description : "",
                imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : "",
              },
            })
          }
        }
      }

      if (body.deleteTakumiIds?.length) {
        await tx.takumiPortfolioProject.deleteMany({
          where: { id: { in: body.deleteTakumiIds }, userId: id },
        })
      }
      if (body.takumiPortfolio?.length) {
        for (const p of body.takumiPortfolio) {
          const title = typeof p.title === "string" ? p.title.trim() : ""
          if (!title && p.id) continue
          if (p.id) {
            await tx.takumiPortfolioProject.updateMany({
              where: { id: p.id, userId: id },
              data: {
                title: title || undefined,
                description: typeof p.description === "string" ? p.description : "",
                imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : "",
                category: typeof p.category === "string" ? p.category : "",
                completionDate: p.completionDate ? new Date(p.completionDate) : null,
              },
            })
          } else if (title.length >= 2) {
            await tx.takumiPortfolioProject.create({
              data: {
                userId: id,
                title,
                description: typeof p.description === "string" ? p.description : "",
                imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : "",
                category: typeof p.category === "string" ? p.category : "",
                completionDate: p.completionDate ? new Date(p.completionDate) : null,
              },
            })
          }
        }
      }

      if (body.availability !== undefined) {
        await tx.availability.upsert({
          where: { userId: id },
          update: {
            ...(body.availability.slots !== undefined && { slots: body.availability.slots as object }),
            ...(body.availability.yearlyRules !== undefined && { yearlyRules: body.availability.yearlyRules as object[] }),
            ...(body.availability.exceptions !== undefined && { exceptions: body.availability.exceptions as object[] }),
            ...(body.availability.instantSlots !== undefined && { instantSlots: body.availability.instantSlots as object }),
          },
          create: {
            userId: id,
            slots: (body.availability.slots ?? {}) as object,
            yearlyRules: (body.availability.yearlyRules ?? []) as object[],
            exceptions: (body.availability.exceptions ?? []) as object[],
            instantSlots: (body.availability.instantSlots ?? {}) as object,
          },
        })
      }

      // Keep user + expert verification flags consistent across all UIs.
      if (expertRow) {
        const hasUserVerified = body.user?.isVerified !== undefined
        const hasExpertVerified = body.expert?.verified !== undefined

        if (hasUserVerified || hasExpertVerified) {
          const currentUser = await tx.user.findUnique({
            where: { id },
            select: { isVerified: true },
          })
          const currentUserVerified = currentUser?.isVerified ?? false
          const currentExpertVerified = !!expertRow.verified

          const incomingUserVerified = hasUserVerified ? !!body.user?.isVerified : currentUserVerified
          const incomingExpertVerified = hasExpertVerified ? !!body.expert?.verified : currentExpertVerified

          let resolvedVerified = incomingUserVerified
          if (!hasUserVerified && hasExpertVerified) {
            resolvedVerified = incomingExpertVerified
          } else if (hasUserVerified && hasExpertVerified) {
            const userChanged = incomingUserVerified !== currentUserVerified
            const expertChanged = incomingExpertVerified !== currentExpertVerified
            if (!userChanged && expertChanged) resolvedVerified = incomingExpertVerified
            else if (userChanged && !expertChanged) resolvedVerified = incomingUserVerified
            else if (userChanged && expertChanged) resolvedVerified = incomingExpertVerified
          }

          if (currentUserVerified !== resolvedVerified) {
            await tx.user.update({
              where: { id },
              data: {
                isVerified: resolvedVerified,
                verificationSource: resolvedVerified ? "MANUAL" : "NONE",
              },
            })
          }
          if (currentExpertVerified !== resolvedVerified) {
            await tx.expert.update({
              where: { id: expertRow.id },
              data: { verified: resolvedVerified },
            })
          }
        }
      }
    })

    return NextResponse.json({ success: true, message: "Profil gespeichert." })
  } catch (err) {
    console.error("[admin/users/profile] PATCH error:", err)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}
