import type { TakumiProfileReviewStatus } from "@prisma/client"

/**
 * Öffentlich angezeigte Bio: bei ausstehender Bio-Überarbeitung bleibt die zuletzt freigegebene Fassung sichtbar.
 */
export function expertPublicBio(expert: {
  bio: string
  bioLive: string
  profileReviewStatus: TakumiProfileReviewStatus
  userId: string | null
}): string {
  if (!expert.userId) {
    return expert.bio
  }
  switch (expert.profileReviewStatus) {
    case "pending_review": {
      const live = expert.bioLive.trim()
      return live || expert.bio.trim()
    }
    case "approved":
      return (expert.bioLive.trim() || expert.bio).trim()
    default:
      return expert.bioLive.trim()
  }
}
