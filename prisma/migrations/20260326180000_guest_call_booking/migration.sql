-- AlterTable: make userId optional and add guest call fields
ALTER TABLE "Booking"
  ALTER COLUMN "userId" DROP NOT NULL,
  ALTER COLUMN "userName" SET DEFAULT '',
  ALTER COLUMN "userEmail" SET DEFAULT '',
  ADD COLUMN "isGuestCall" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guestEmail" TEXT,
  ADD COLUMN "guestToken" TEXT;

-- CreateIndex: unique guestToken for fast lookup via public URL
CREATE UNIQUE INDEX "Booking_guestToken_key" ON "Booking"("guestToken");
