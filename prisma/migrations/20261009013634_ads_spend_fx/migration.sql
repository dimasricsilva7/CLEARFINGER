-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "utmId" TEXT;

-- CreateTable
CREATE TABLE "AdSpendDaily" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "spendCents" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "metaPurchases" INTEGER NOT NULL DEFAULT 0,
    "metaPurchaseValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSpendDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "date" TEXT NOT NULL,
    "usdBrl" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'bcb_ptax',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "AdSpendDaily_date_idx" ON "AdSpendDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdSpendDaily_date_accountId_campaignId_key" ON "AdSpendDaily"("date", "accountId", "campaignId");
