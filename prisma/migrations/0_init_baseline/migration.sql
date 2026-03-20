-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('shugyo', 'takumi');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'paused');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'active', 'completed', 'declined', 'cancelled', 'cancelled_in_handshake');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'pending', 'paid', 'refunded', 'failed');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('VIDEO', 'VOICE');

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('scheduled', 'instant');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('NEULING', 'FORTGESCHRITTEN', 'PROFI');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('CHAT', 'MAIL');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('SYSTEM', 'BOOKING');

-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('offline', 'available', 'in_call', 'busy');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'AUTHORIZED', 'CAPTURED', 'CANCELED', 'REFUNDED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "appRole" "AppRole" NOT NULL DEFAULT 'shugyo',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT NOT NULL DEFAULT '',
    "favorites" TEXT[],
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "customerNumber" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "pendingBalance" INTEGER NOT NULL DEFAULT 0,
    "refundPreference" TEXT NOT NULL DEFAULT 'payout',
    "invoiceData" JSONB,
    "skillLevel" "SkillLevel",
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShugyoProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShugyoProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expert" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "responseTime" TEXT NOT NULL DEFAULT '< 5 Min',
    "priceVideo15Min" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "priceVoice15Min" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pricePerSession" INTEGER,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "liveStatus" "LiveStatus",
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "portfolio" TEXT[],
    "joinedDate" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "matchRate" INTEGER NOT NULL DEFAULT 0,
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "cancelPolicy" JSONB NOT NULL DEFAULT '{"freeHours":24,"feePercent":0}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeConnectAccountId" TEXT,

    CONSTRAINT "Expert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakumiPortfolioProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "completionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TakumiPortfolioProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "expertName" TEXT NOT NULL,
    "expertEmail" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "bookingMode" "BookingMode" NOT NULL DEFAULT 'scheduled',
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "callType" "CallType" NOT NULL DEFAULT 'VIDEO',
    "totalPrice" DECIMAL(10,2),
    "price" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "statusToken" TEXT NOT NULL,
    "dailyRoomUrl" TEXT NOT NULL DEFAULT '',
    "sessionStartedAt" TIMESTAMP(3),
    "sessionEndedAt" TIMESTAMP(3),
    "sessionDuration" INTEGER,
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "shugyoFrozenAt" TIMESTAMP(3),
    "safetyAcceptedAt" TIMESTAMP(3),
    "snapshotConsentAt" TIMESTAMP(3),
    "expertRating" DOUBLE PRECISION,
    "expertReviewText" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidAmount" INTEGER,
    "cancelledBy" TEXT,
    "cancelFeeAmount" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slots" JSONB NOT NULL DEFAULT '{"0":[],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}',
    "yearlyRules" JSONB NOT NULL DEFAULT '[]',
    "exceptions" JSONB NOT NULL DEFAULT '[]',
    "instantSlots" JSONB NOT NULL DEFAULT '{"0":[],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bookingId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "availableVariables" JSONB,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateTranslation" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,

    CONSTRAINT "TemplateTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "communicationType" "CommunicationType" NOT NULL DEFAULT 'CHAT',
    "senderId" TEXT,
    "senderDisplayName" TEXT,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT,
    "text" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentThumbnailUrl" TEXT,
    "attachmentFilename" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "netPayout" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'AUTHORIZED',
    "invoiceNumber" TEXT,
    "creditNoteNumber" TEXT,
    "invoicePdfUrl" TEXT,
    "creditNotePdfUrl" TEXT,
    "stornoInvoiceNumber" TEXT,
    "stornoCreditNoteNumber" TEXT,
    "stornoInvoicePdfUrl" TEXT,
    "stornoCreditNotePdfUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "invoiceEmailSentAt" TIMESTAMP(3),
    "creditNoteEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyReport" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reporterRole" TEXT NOT NULL,
    "reason" TEXT,
    "details" TEXT DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_customerNumber_key" ON "User"("customerNumber");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShugyoProject_userId_idx" ON "ShugyoProject"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "Expert_userId_key" ON "Expert"("userId");

-- CreateIndex
CREATE INDEX "TakumiPortfolioProject_userId_idx" ON "TakumiPortfolioProject"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_statusToken_key" ON "Booking"("statusToken");

-- CreateIndex
CREATE INDEX "Booking_expertId_date_status_idx" ON "Booking"("expertId", "date", "status");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_statusToken_idx" ON "Booking"("statusToken");

-- CreateIndex
CREATE INDEX "Review_expertId_idx" ON "Review"("expertId");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_userId_key" ON "Availability"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_slug_key" ON "CommunicationTemplate"("slug");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_slug_idx" ON "CommunicationTemplate"("slug");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_category_idx" ON "CommunicationTemplate"("category");

-- CreateIndex
CREATE INDEX "TemplateTranslation_templateId_idx" ON "TemplateTranslation"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateTranslation_templateId_language_key" ON "TemplateTranslation"("templateId", "language");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_recipientId_idx" ON "DirectMessage"("senderId", "recipientId");

-- CreateIndex
CREATE INDEX "DirectMessage_recipientId_senderId_idx" ON "DirectMessage"("recipientId", "senderId");

-- CreateIndex
CREATE INDEX "DirectMessage_recipientId_read_idx" ON "DirectMessage"("recipientId", "read");

-- CreateIndex
CREATE INDEX "DirectMessage_communicationType_idx" ON "DirectMessage"("communicationType");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_bookingId_key" ON "Transaction"("bookingId");

-- CreateIndex
CREATE INDEX "Transaction_expertId_idx" ON "Transaction"("expertId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "SafetyReport_bookingId_idx" ON "SafetyReport"("bookingId");

-- CreateIndex
CREATE INDEX "SafetyReport_reporterId_idx" ON "SafetyReport"("reporterId");

-- CreateIndex
CREATE INDEX "SafetyReport_reportedId_idx" ON "SafetyReport"("reportedId");

-- CreateIndex
CREATE INDEX "SafetyReport_status_idx" ON "SafetyReport"("status");

-- CreateIndex
CREATE INDEX "SafetyIncident_bookingId_idx" ON "SafetyIncident"("bookingId");

-- CreateIndex
CREATE INDEX "SafetyIncident_status_idx" ON "SafetyIncident"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceCounter_type_key" ON "InvoiceCounter"("type");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShugyoProject" ADD CONSTRAINT "ShugyoProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expert" ADD CONSTRAINT "Expert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakumiPortfolioProject" ADD CONSTRAINT "TakumiPortfolioProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTranslation" ADD CONSTRAINT "TemplateTranslation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

