-- AlterEnum: Add cancelled_in_handshake to BookingStatus (session < 5 min, payment released)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'BookingStatus' AND e.enumlabel = 'cancelled_in_handshake'
  ) THEN
    ALTER TYPE "BookingStatus" ADD VALUE 'cancelled_in_handshake';
  END IF;
END $$;
