-- AlterEnum: Add instant_expired to BookingStatus (Instant Connect: no Takumi answer within 60s)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BookingStatus' AND e.enumlabel = 'instant_expired'
  ) THEN
    ALTER TYPE "BookingStatus" ADD VALUE 'instant_expired';
  END IF;
END $$;
