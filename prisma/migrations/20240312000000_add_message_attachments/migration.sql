-- AlterTable (idempotent für PostgreSQL 11+)
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "attachmentThumbnailUrl" TEXT;
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "attachmentFilename" TEXT;
