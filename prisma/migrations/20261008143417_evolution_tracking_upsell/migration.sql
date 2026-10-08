-- AlterEnum
ALTER TYPE "OrderItemKind" ADD VALUE 'UPSELL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "parentOrderId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'CHECKOUT',
ADD COLUMN     "upsellId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtitle" TEXT;

-- CreateTable
CREATE TABLE "Upsell" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceCents" INTEGER NOT NULL,
    "compareAtPriceCents" INTEGER,
    "imageUrl" TEXT,
    "badge" TEXT,
    "acceptLabel" TEXT NOT NULL DEFAULT 'Sim, quero adicionar',
    "declineLabel" TEXT NOT NULL DEFAULT 'Não, obrigado',
    "trigger" TEXT NOT NULL DEFAULT 'ANY_CONFIRMED',
    "position" TEXT NOT NULL DEFAULT 'TOP',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upsell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpsellEvent" (
    "id" TEXT NOT NULL,
    "upsellId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpsellEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTrackingEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT true,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpsellEvent_createdAt_idx" ON "UpsellEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UpsellEvent_upsellId_orderId_action_key" ON "UpsellEvent"("upsellId", "orderId", "action");

-- CreateIndex
CREATE INDEX "OrderTrackingEvent_orderId_occurredAt_idx" ON "OrderTrackingEvent"("orderId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderTrackingEvent_orderId_status_automatic_occurredAt_key" ON "OrderTrackingEvent"("orderId", "status", "automatic", "occurredAt");

-- CreateIndex
CREATE INDEX "Order_parentOrderId_idx" ON "Order"("parentOrderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_upsellId_fkey" FOREIGN KEY ("upsellId") REFERENCES "Upsell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upsell" ADD CONSTRAINT "Upsell_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpsellEvent" ADD CONSTRAINT "UpsellEvent_upsellId_fkey" FOREIGN KEY ("upsellId") REFERENCES "Upsell"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpsellEvent" ADD CONSTRAINT "UpsellEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTrackingEvent" ADD CONSTRAINT "OrderTrackingEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
