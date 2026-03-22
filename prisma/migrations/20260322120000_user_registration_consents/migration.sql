-- Registrierung: nachweisbare Einwilligungen (DSGVO / VZ)

ALTER TABLE "User" ADD COLUMN "acceptedAgbVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "acceptedAgbAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "acceptedPrivacyVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "acceptedPrivacyAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "earlyPerformanceWaiverAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "paymentProcessorConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "takumiExpertDeclarationAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "marketingOptInAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "marketingDoubleOptInAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "registrationIpHash" TEXT;
