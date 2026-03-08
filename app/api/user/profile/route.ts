import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/** GET — return full profile from PostgreSQL */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true, role: true, appRole: true, favorites: true, refundPreference: true, invoiceData: true, createdAt: true },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    return NextResponse.json({
      name: user.name,
      email: user.email,
      image: user.image || "",
      role: user.role,
      appRole: user.appRole || "shugyo",
      favorites: user.favorites || [],
      refundPreference: user.refundPreference || "payout",
      invoiceData: user.invoiceData ?? null,
      createdAt: user.createdAt,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** PATCH — update user profile */
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data: Record<string, string | object | null> = {}

    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length < 2) {
        return NextResponse.json({ error: "Name muss mindestens 2 Zeichen lang sein." }, { status: 400 })
      }
      data.name = body.name.trim()
    }
    if (body.image !== undefined) data.image = body.image
    if (body.appRole !== undefined) {
      if (!["shugyo", "takumi"].includes(body.appRole)) {
        return NextResponse.json({ error: "Ungueltige Rolle." }, { status: 400 })
      }
      data.appRole = body.appRole
    }
    if (body.refundPreference !== undefined) {
      if (!["payout", "wallet"].includes(body.refundPreference)) {
        return NextResponse.json({ error: "Ungueltige Refund-Präferenz." }, { status: 400 })
      }
      data.refundPreference = body.refundPreference
    }
    if (body.invoiceData !== undefined) {
      if (body.invoiceData !== null && typeof body.invoiceData !== "object") {
        return NextResponse.json({ error: "Ungueltige Rechnungsdaten." }, { status: 400 })
      }
      data.invoiceData = body.invoiceData
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Aenderungen angegeben." }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
    })

    // Sync: Bei appRole takumi muss ein Expert existieren (konsistente Admin-Anzeige)
    if (data.appRole === "takumi") {
      const existing = await prisma.expert.findUnique({
        where: { userId: session.user.id },
      })
      if (!existing) {
        await prisma.expert.create({
          data: {
            userId: session.user.id,
            name: user.name,
            avatar: (user.name && user.name.charAt(0).toUpperCase()) || "T",
            email: user.email ?? "",
            categorySlug: "dienstleistungen",
            categoryName: "Dienstleistungen",
            subcategory: "",
            bio: "",
            pricePerSession: 0,
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
      }
    }

    return NextResponse.json({
      success: true,
      name: user.name,
      image: user.image,
      message: "Profil erfolgreich aktualisiert.",
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
