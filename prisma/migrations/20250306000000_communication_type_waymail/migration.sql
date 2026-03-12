-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('CHAT', 'MAIL');

-- AlterTable DirectMessage: communicationType, subject, senderDisplayName, senderId nullable
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "communicationType" "CommunicationType" NOT NULL DEFAULT 'CHAT';
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "senderDisplayName" TEXT;

-- Make senderId nullable (for system waymails)
ALTER TABLE "DirectMessage" ALTER COLUMN "senderId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DirectMessage_communicationType_idx" ON "DirectMessage"("communicationType");
