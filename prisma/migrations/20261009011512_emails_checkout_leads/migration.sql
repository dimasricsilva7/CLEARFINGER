-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('PURCHASE_CONFIRMATION', 'PIX_RECOVERY');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "emailOptOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'SCHEDULED',
    "toEmail" TEXT NOT NULL,
    "subject" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "error" TEXT,
    "triggeredBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutLead" (
    "id" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "offerId" TEXT,
    "bumpIds" JSONB,
    "itemsSummary" TEXT,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "sessionId" TEXT,
    "visitorId" TEXT,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "device" TEXT,
    "orderId" TEXT,
    "emailStatus" "EmailStatus",
    "emailScheduledFor" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "emailError" TEXT,
    "emailOptOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEvent_status_scheduledFor_idx" ON "EmailEvent"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "EmailEvent_orderId_idx" ON "EmailEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutLead_clientKey_key" ON "CheckoutLead"("clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutLead_token_key" ON "CheckoutLead"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutLead_orderId_key" ON "CheckoutLead"("orderId");

-- CreateIndex
CREATE INDEX "CheckoutLead_emailStatus_emailScheduledFor_idx" ON "CheckoutLead"("emailStatus", "emailScheduledFor");

-- CreateIndex
CREATE INDEX "CheckoutLead_createdAt_idx" ON "CheckoutLead"("createdAt");

-- CreateIndex
CREATE INDEX "CheckoutLead_email_idx" ON "CheckoutLead"("email");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutLead" ADD CONSTRAINT "CheckoutLead_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
