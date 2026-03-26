import type { TakumiProfileReviewStatus } from "@prisma/client"
import { isBioChangeSignificant } from "@/lib/bio-significant-change"

/** Standard-Text bei Ablehnung (Support nur per E-Mail, kein Waymail-Hinweis) */
export const TAKUMI_PROFILE_REJECTION_STANDARD_DE =
  "Dein Profil entspricht nicht unseren Richtlinien. Bitte überprüfe deine Angaben und passe sie an. Bei Rückfragen kontaktierst du das diAiway-Team am besten per E-Mail: admin@diaiway.com"

export const ADMIN_SUPPORT_EMAIL = "admin@diaiway.com"
export const ADMIN_SUPPORT_MAILTO = "mailto:admin@diaiway.com"

export type SubmitReviewComputation = {
  profileReviewStatus: TakumiProfileReviewStatus
  /** Bei kleiner Bio-Änderung: sofort mit freigegebener Bio synchronisieren */
  syncBioLiveToBio?: boolean
}

export function computeProfileSubmitState(args: {
  previousStatus: TakumiProfileReviewStatus | null
  previousBioLive: string
  nextBio: string
}): SubmitReviewComputation {
  const st = args.previousStatus
  if (st === null || st === "draft" || st === "rejected") {
    return { profileReviewStatus: "pending_review" }
  }
  if (st === "pending_review") {
    return { profileReviewStatus: "pending_review" }
  }
  // approved
  const live = (args.previousBioLive || "").trim()
  if (!live) {
    return isBioChangeSignificant(args.nextBio, "")
      ? { profileReviewStatus: "pending_review" }
      : { profileReviewStatus: "approved", syncBioLiveToBio: true }
  }
  if (isBioChangeSignificant(args.nextBio, live)) {
    return { profileReviewStatus: "pending_review" }
  }
  return { profileReviewStatus: "approved", syncBioLiveToBio: true }
}
