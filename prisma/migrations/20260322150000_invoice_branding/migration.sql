-- CreateTable
CREATE TABLE "InvoiceBranding" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "logoUrl" TEXT,
    "accentHex" TEXT NOT NULL DEFAULT '#064e3b',
    "footerText" TEXT,
    "paymentNote" TEXT,
    "closingLine" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceBranding_pkey" PRIMARY KEY ("id")
);

INSERT INTO "InvoiceBranding" ("id", "accentHex", "updatedAt") VALUES ('default', '#064e3b', CURRENT_TIMESTAMP);
