-- E-Mail-Verifizierung (Double Opt-In)
-- Fügt nur die neuen Spalten hinzu, löscht keine bestehenden.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailConfirmedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpiry" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerificationToken_key" ON "User"("emailVerificationToken") WHERE "emailVerificationToken" IS NOT NULL;
