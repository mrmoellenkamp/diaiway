/**
 * E2E Setup API — nur aktiv wenn E2E_ENABLED=true
 * Bereitet Daten für den vollständigen Playwright-Flow vor.
 */

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import { seedTakumis } from "@/lib/seed-data"
import { processCompletion } from "@/app/actions/process-completion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const E2E_PREFIX = "e2e-"

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function emailForName(name: string): string {
  const local = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")
  return `${local || "expert"}@diaiway.test`
}

export async function GET(req: NextRequest) {
  if (process.env.E2E_ENABLED !== "true") {
    return NextResponse.json({ error: "E2E API deaktiviert." }, { status: 404 })
  }

  const action = req.nextUrl.searchParams.get("action") || "setup"

  try {
    if (action === "setup") {
      const password = "Test123!?"
      const ts = Date.now().toString(36)
      const shugyoEmail = `${E2E_PREFIX}shugyo-${ts}@diaiway.test`
      const takumiEmail = `${E2E_PREFIX}takumi-${ts}@diaiway.test`

      // 1. Takumis seeden falls leer
      let experts = await prisma.expert.findMany({ take: 1 })
      if (experts.length === 0) {
        const seedData = seedTakumis.map((t) => ({
          name: t.name,
          email: emailForName(t.name),
          avatar: t.avatar,
          categorySlug: t.categorySlug,
          categoryName: t.categoryName,
          subcategory: t.subcategory,
          bio: t.bio,
          rating: t.rating,
          reviewCount: t.reviewCount,
          sessionCount: t.sessionCount,
          responseTime: t.responseTime,
          pricePerSession: t.pricePerSession,
          isLive: t.isLive,
          isPro: t.isPro,
          verified: t.verified,
          portfolio: t.portfolio,
          joinedDate: t.joinedDate,
          imageUrl: "",
          matchRate: 80,
        }))
        await prisma.expert.createMany({ data: seedData })
        experts = await prisma.expert.findMany({ take: 1 })
      }

      const expert = experts[0]
      if (!expert) return NextResponse.json({ error: "Kein Expert." }, { status: 500 })

      // 2. Takumi-User erstellen & verknüpfen
      let takumiUser = await prisma.user.findFirst({ where: { email: takumiEmail } })
      if (!takumiUser) {
        const hashed = await bcrypt.hash(password, 12)
        takumiUser = await prisma.user.create({
          data: {
            name: expert.name,
            email: takumiEmail,
            password: hashed,
            role: "user",
            appRole: "takumi",
          },
        })
        await prisma.expert.update({
          where: { id: expert.id },
          data: { userId: takumiUser.id, email: takumiUser.email },
        })
      }

      // 3. Availability für Takumi (Mo–So 09:00–18:00)
      const slots = Object.fromEntries(
        [0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ start: "09:00", end: "18:00" }]])
      )
      await prisma.availability.upsert({
        where: { userId: takumiUser.id },
        create: { userId: takumiUser.id, slots: slots as object },
        update: { slots: slots as object },
      })

      // 4. Shugyo-User mit Wallet-Guthaben
      let shugyoUser = await prisma.user.findFirst({ where: { email: shugyoEmail } })
      if (!shugyoUser) {
        const hashed = await bcrypt.hash(password, 12)
        shugyoUser = await prisma.user.create({
          data: {
            name: "E2E Shugyo",
            email: shugyoEmail,
            password: hashed,
            role: "user",
            appRole: "shugyo",
            balance: 10000, // 100 EUR für Buchungen
          },
        })
      } else {
        await prisma.user.update({
          where: { id: shugyoUser.id },
          data: { balance: 10000 },
        })
      }

      // 5. Buchung in der Vergangenheit (Raum sofort öffenbar)
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 2)
      const dateStr = formatDate(pastDate)
      const startTime = "10:00"
      const endTime = "10:30"
      const price = expert.pricePerSession ?? 0
      const paidAmount = price * 100
      const platformFee = Math.round(paidAmount * 0.15)
      const netPayout = paidAmount - platformFee

      const statusToken = randomBytes(24).toString("hex")
      const booking = await prisma.booking.create({
        data: {
          expertId: expert.id,
          expertName: expert.name,
          expertEmail: takumiUser.email,
          userId: shugyoUser.id,
          userName: shugyoUser.name,
          userEmail: shugyoEmail,
          date: dateStr,
          startTime,
          endTime,
          status: "confirmed",
          price,
          statusToken,
          paymentStatus: "paid",
          stripePaymentIntentId: "wallet",
          paidAt: new Date(),
          paidAmount,
        },
      })

      await prisma.transaction.create({
        data: {
          bookingId: booking.id,
          expertId: expert.id,
          userId: shugyoUser.id,
          totalAmount: paidAmount,
          platformFee,
          netPayout,
          status: "AUTHORIZED",
        },
      })

      return NextResponse.json({
        shugyoEmail,
        shugyoPassword: password,
        takumiEmail,
        takumiPassword: password,
        bookingId: booking.id,
        statusToken,
        expertId: expert.id,
      })
    }

    if (action === "process-completion") {
      const bookingId = req.nextUrl.searchParams.get("bookingId")
      if (!bookingId) return NextResponse.json({ error: "bookingId fehlt." }, { status: 400 })
      const result = await processCompletion(bookingId)
      return NextResponse.json({ ok: result.ok, error: result.error })
    }

    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 })
  } catch (err) {
    console.error("[E2E Setup] Error:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
