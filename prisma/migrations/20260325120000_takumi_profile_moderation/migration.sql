-- CreateEnum
CREATE TYPE "TakumiProfileReviewStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "Expert" ADD COLUMN "bioLive" TEXT NOT NULL DEFAULT '',
ADD COLUMN "profileReviewStatus" "TakumiProfileReviewStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN "profileSubmittedAt" TIMESTAMP(3),
ADD COLUMN "profileReviewedAt" TIMESTAMP(3),
ADD COLUMN "profileRejectedAt" TIMESTAMP(3),
ADD COLUMN "profileRejectionReason" TEXT,
ADD COLUMN "profileReviewedByUserId" TEXT;

-- Bestehende Experten: wie bisher behandeln (öffentliche Bio = Arbeits-Bio)
UPDATE "Expert" SET "profileReviewStatus" = 'approved', "bioLive" = "bio";

-- CreateIndex
CREATE INDEX "Expert_profileReviewStatus_idx" ON "Expert"("profileReviewStatus");
