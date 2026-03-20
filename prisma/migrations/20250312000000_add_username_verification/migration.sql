-- CreateEnum (idempotent: DB kann den Typ schon haben, z. B. nach db push / abgebrochener Migration)
DO $$ BEGIN
  CREATE TYPE "VerificationSource" AS ENUM ('NONE', 'STRIPE_CONNECT', 'STRIPE_PAYMENT', 'ACTIVITY', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationSource" "VerificationSource" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
