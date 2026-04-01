-- Per-party Pre-Call Safety (Shugyo vs Takumi); legacy safetyAcceptedAt backfill for both.

ALTER TABLE "Booking" ADD COLUMN "bookerSafetyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "expertSafetyAcceptedAt" TIMESTAMP(3);

UPDATE "Booking"
SET
  "bookerSafetyAcceptedAt" = "safetyAcceptedAt",
  "expertSafetyAcceptedAt" = "safetyAcceptedAt"
WHERE "safetyAcceptedAt" IS NOT NULL;
