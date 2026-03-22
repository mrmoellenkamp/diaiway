import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { sendVerificationEmail } from "@/lib/email"
import { sendWelcomeWaymail } from "@/lib/onboarding"
import { getLegalConsentVersion } from "@/lib/legal-consent-version"
import { hashRegistrationIp } from "@/lib/registration-ip-hash"

const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"

export const runtime = "nodejs"

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Das Passwort muss mindestens 8 Zeichen lang sein."
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw))
    return "Das Passwort muss mindestens eine Zahl oder ein Sonderzeichen enthalten."
  return null
}

type AppRoleChoice = "shugyo" | "takumi"

type ConsentBody = {
  agbAndPrivacy?: boolean
  marketing?: boolean
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const body = await req.json()

    if (body._hp) {
      return NextResponse.json(
        { success: true, message: "Konto erfolgreich erstellt." },
        { status: 201 }
      )
    }

    const { name, email, password, username: rawUsername, appRole: rawAppRole, consents: rawConsents } = body

    const rlIp = rateLimit(`register:ip:${ip}`, { limit: 5, windowSec: 900 })
    if (!rlIp.success) {
      return NextResponse.json(
        { error: `Zu viele Versuche. Bitte warte ${rlIp.retryAfterSec} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(rlIp.retryAfterSec) } }
      )
    }
    const rlEmail = rateLimit(`register:email:${(email || "").toLowerCase()}`, { limit: 3, windowSec: 3600 })
    if (!rlEmail.success) {
      return NextResponse.json(
        { error: `Zu viele Versuche fuer diese E-Mail. Bitte warte ${rlEmail.retryAfterSec} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(rlEmail.retryAfterSec) } }
      )
    }

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      )
    }

    const pwError = validatePassword(password)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const MAX_NAME_LEN = 120
    const MAX_EMAIL_LEN = 254
    if (name.trim().length > MAX_NAME_LEN) {
      return NextResponse.json({ error: `Der Name darf maximal ${MAX_NAME_LEN} Zeichen haben.` }, { status: 400 })
    }
    if (normalizedEmail.length > MAX_EMAIL_LEN) {
      return NextResponse.json({ error: "E-Mail-Adresse ist zu lang." }, { status: 400 })
    }

    const appRole: AppRoleChoice = rawAppRole === "takumi" ? "takumi" : "shugyo"
    const consents: ConsentBody =
      rawConsents && typeof rawConsents === "object" ? (rawConsents as ConsentBody) : {}
    if (consents.agbAndPrivacy !== true) {
      return NextResponse.json({ error: "AGB und Datenschutz müssen akzeptiert werden." }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert." },
        { status: 409 }
      )
    }

    const hashed = await bcrypt.hash(password, 12)

    const desiredUsername = typeof rawUsername === "string" ? rawUsername.trim() : ""
    if (!desiredUsername) {
      return NextResponse.json({ error: "Benutzername ist erforderlich." }, { status: 400 })
    }
    const { validateUsername } = await import("@/lib/username-validation")
    const validation = validateUsername(desiredUsername)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const taken = await prisma.user.findUnique({ where: { username: desiredUsername } })
    if (taken) {
      return NextResponse.json({ error: "Dieser Benutzername ist bereits vergeben." }, { status: 409 })
    }
    const username = desiredUsername
    const token = crypto.randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const legalVersion = getLegalConsentVersion()
    const now = new Date()
    const ipHash = hashRegistrationIp(ip)

    const marketingOn = consents.marketing === true
    /** Takumi: keine Session-Sperre; Shugyo: Phase-2-Modal vor Buchung */
    const isPaymentVerified = appRole === "takumi"

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: name.trim(),
          username,
          email: normalizedEmail,
          password: hashed,
          role: "user",
          appRole,
          favorites: [],
          emailVerificationToken: token,
          emailVerificationExpiry: expiry,
          acceptedAgbVersion: legalVersion,
          acceptedAgbAt: now,
          acceptedPrivacyVersion: legalVersion,
          acceptedPrivacyAt: now,
          earlyPerformanceWaiverAt: null,
          paymentProcessorConsentAt: null,
          takumiExpertDeclarationAt: null,
          marketingOptIn: marketingOn,
          marketingOptInAt: marketingOn ? now : null,
          registrationIpHash: ipHash,
          isPaymentVerified,
        },
      })

      if (appRole === "takumi") {
        const displayName = username
        await tx.expert.create({
          data: {
            userId: u.id,
            name: displayName,
            avatar: (displayName && displayName.charAt(0).toUpperCase()) || "T",
            email: u.email ?? "",
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
            joinedDate: now.toISOString().slice(0, 10),
            matchRate: 0,
          },
        })
      }

      return u
    })

    const verifyUrl = `${baseUrl}/api/auth/verify-email/${token}`
    sendVerificationEmail({ to: normalizedEmail, name: username, verifyUrl }).catch((err) =>
      console.error("[register] Verification email failed:", err)
    )
    sendWelcomeWaymail(user.id).catch(() => {})

    return NextResponse.json(
      { success: true, message: "Konto erfolgreich erstellt.", userId: user.id },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registrierungsfehler"
    console.error("[diAiway] Register error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}
