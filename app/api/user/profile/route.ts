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
      select: { name: true, username: true, email: true, image: true, role: true, appRole: true, favorites: true, refundPreference: true, invoiceData: true, skillLevel: true, languages: true, isVerified: true, createdAt: true },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    return NextResponse.json({
      name: user.name,
      username: user.username ?? null,
      email: user.email,
      image: user.image || "",
      role: user.role,
      appRole: user.appRole || "shugyo",
      favorites: user.favorites || [],
      refundPreference: user.refundPreference || "payout",
      invoiceData: user.invoiceData ?? null,
      skillLevel: user.skillLevel ?? null,
      languages: user.languages ?? [],
      isVerified: user.isVerified ?? false,
      createdAt: user.createdAt,
    })
  } catch (err: unknown) {
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
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
    const data: Record<string, string | object | string[] | null> = {}

    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length < 2) {
        return NextResponse.json({ error: "Name muss mindestens 2 Zeichen lang sein." }, { status: 400 })
      }
      data.name = body.name.trim()
    }
    if (body.username !== undefined) {
      const val = typeof body.username === "string" ? body.username.trim() : ""
      if (val === "") {
        data.username = null
      } else {
        const { validateUsername } = await import("@/app/actions/username")
        const res = await validateUsername(val)
        if (!res.ok) {
          return NextResponse.json({ error: res.error }, { status: 400 })
        }
        const existing = await prisma.user.findFirst({
          where: { username: val, NOT: { id: session.user.id } },
        })
        if (existing) {
          return NextResponse.json({ error: "Dieser Benutzername ist bereits vergeben." }, { status: 409 })
        }
        data.username = val
      }
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
      if (body.invoiceData === null) {
        data.invoiceData = null
      } else {
        const { sanitizeInvoiceData } = await import("@/lib/security")
        const sanitized = sanitizeInvoiceData(body.invoiceData)
        if (!sanitized) return NextResponse.json({ error: "Ungültige Rechnungsdaten." }, { status: 400 })
        data.invoiceData = sanitized
      }
    }
    if (body.skillLevel !== undefined) {
      const valid = ["NEULING", "FORTGESCHRITTEN", "PROFI"]
      if (body.skillLevel !== null && !valid.includes(body.skillLevel)) {
        return NextResponse.json({ error: "Ungueltige Kenntnisstufe." }, { status: 400 })
      }
      data.skillLevel = body.skillLevel
    }
    if (body.languages !== undefined) {
      const valid = ["de", "en", "es", "fr", "it"]
      const arr = Array.isArray(body.languages) ? body.languages : []
      const filtered = arr.filter((l: string) => valid.includes(String(l).toLowerCase()))
      data.languages = [...new Set(filtered)]
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
            priceVideo15Min: 1,
            priceVoice15Min: 1,
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
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}
