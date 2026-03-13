-- CreateEnum
CREATE TYPE "VerificationSource" AS ENUM ('NONE', 'STRIPE_CONNECT', 'STRIPE_PAYMENT', 'ACTIVITY', 'MANUAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "verificationSource" "VerificationSource" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
