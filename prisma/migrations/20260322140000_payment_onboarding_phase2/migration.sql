-- Phase 2: Zahlungs-Onboarding + Session-Gate für Shugyos

ALTER TABLE "User" ADD COLUMN "isPaymentVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "phase2BillingConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "phase2BillingConsentIpHash" TEXT;
ALTER TABLE "User" ADD COLUMN "phase2WithdrawalWaiverAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "phase2WithdrawalWaiverIpHash" TEXT;

-- Bestand: Takumis nicht blockieren; Shugyos mit alter Zahlungseinwilligung gelten als verifiziert
UPDATE "User" SET "isPaymentVerified" = true WHERE "appRole" = 'takumi';
UPDATE "User" SET "isPaymentVerified" = true WHERE "paymentProcessorConsentAt" IS NOT NULL;
