import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { getLegalConsentVersion } from "@/lib/legal-consent-version"
import { sendWelcomeWaymail } from "@/lib/onboarding"

/**
 * Creates a full Shugyo account for a guest who set a password during checkout.
 * Called from the Stripe webhook after payment is confirmed.
 *
 * Returns the created userId, or null if no account should be created
 * (e.g. no password set, or email already registered).
 */
export async function createGuestShugyoAccount(params: {
  guestEmail: string
  password: string
  invoiceData: unknown
  consentTimestamp: Date
}): Promise<{ userId: string; isNew: boolean } | null> {
  const { guestEmail, password, invoiceData, consentTimestamp } = params

  const normalizedEmail = guestEmail.toLowerCase().trim()
  if (!normalizedEmail) return null

  // If an account already exists for this email, return it (idempotent)
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })
  if (existing) {
    return { userId: existing.id, isNew: false }
  }

  const hashed = await bcrypt.hash(password, 12)
  const legalVersion = getLegalConsentVersion()
  const now = consentTimestamp

  // Generate a unique username derived from the email local part
  const username = await generateUniqueUsername(normalizedEmail)

  // Extract display name from invoice data or email
  const displayName = extractDisplayName(invoiceData, normalizedEmail)

  const user = await prisma.user.create({
    data: {
      name: displayName,
      username,
      email: normalizedEmail,
      password: hashed,
      role: "user",
      appRole: "shugyo",
      favorites: [],
      // Email is considered verified since they paid via Stripe (email was validated at checkout)
      emailConfirmedAt: now,
      acceptedAgbVersion: legalVersion,
      acceptedAgbAt: now,
      acceptedPrivacyVersion: legalVersion,
      acceptedPrivacyAt: now,
      // Right-of-withdrawal waiver was accepted at checkout
      earlyPerformanceWaiverAt: now,
      isPaymentVerified: true, // Stripe payment already confirmed
      invoiceData: invoiceData ?? undefined,
    },
  })

  // Send welcome waymail asynchronously (non-blocking)
  sendWelcomeWaymail(user.id).catch((err) =>
    console.error("[guest-onboarding] sendWelcomeWaymail failed:", err)
  )

  return { userId: user.id, isNew: true }
}

/**
 * Generates a unique username from an email address.
 * e.g. "john.doe@example.com" → "johndoe", "johndoe_2", "johndoe_3", ...
 */
async function generateUniqueUsername(email: string): Promise<string> {
  const localPart = email.split("@")[0] ?? "gast"
  // Keep only alphanumeric + underscore, lowercase
  const base = localPart.replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 30) || "gast"

  // Try base first, then base_2, base_3, ...
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}_${i + 1}`
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })
    if (!taken) return candidate
  }

  // Fallback: append random suffix
  return `${base}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Extracts a human-readable display name from invoice data or falls back to email.
 */
function extractDisplayName(invoiceData: unknown, email: string): string {
  if (invoiceData && typeof invoiceData === "object") {
    const inv = invoiceData as Record<string, unknown>
    if (inv.type === "unternehmen" && typeof inv.companyName === "string" && inv.companyName.trim()) {
      return inv.companyName.trim().slice(0, 120)
    }
    if (typeof inv.fullName === "string" && inv.fullName.trim()) {
      return inv.fullName.trim().slice(0, 120)
    }
  }
  // Fallback: use email local part, capitalized
  const local = email.split("@")[0] ?? "Gast"
  return local.charAt(0).toUpperCase() + local.slice(1)
}
