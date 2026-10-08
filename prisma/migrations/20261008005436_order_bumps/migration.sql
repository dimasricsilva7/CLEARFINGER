-- CreateEnum
CREATE TYPE "OrderItemKind" AS ENUM ('OFFER', 'ORDER_BUMP');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "bumpId" TEXT,
ADD COLUMN     "kind" "OrderItemKind" NOT NULL DEFAULT 'OFFER';

-- CreateTable
CREATE TABLE "OrderBump" (
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
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderBump_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderBump" ADD CONSTRAINT "OrderBump_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_bumpId_fkey" FOREIGN KEY ("bumpId") REFERENCES "OrderBump"("id") ON DELETE SET NULL ON UPDATE CASCADE;
