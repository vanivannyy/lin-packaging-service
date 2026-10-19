-- CreateEnum
CREATE TYPE "ClientStockSide" AS ENUM ('LIN_WAREHOUSE', 'CLIENT_WAREHOUSE');

-- CreateEnum
CREATE TYPE "ClientStockMovementType" AS ENUM ('PRODUCTION_IN', 'DELIVERY_OUT', 'ADMIN_ADJUSTMENT', 'CLIENT_REPORT');

-- CreateTable
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFinishedGoodsItem" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT,
    "itemName" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "linWarehouseQty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "clientWarehouseQty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "minStockQty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "clientReportedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientFinishedGoodsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientStockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "side" "ClientStockSide" NOT NULL,
    "type" "ClientStockMovementType" NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "resultingQty" DECIMAL(15,3) NOT NULL,
    "note" TEXT,
    "referenceCode" TEXT,
    "actorUserId" TEXT,
    "actorClientAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientNotification" (
    "id" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "type" TEXT NOT NULL DEFAULT 'STATUS',
    "referenceCode" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccount_email_key" ON "ClientAccount"("email");

-- CreateIndex
CREATE INDEX "ClientAccount_customerId_idx" ON "ClientAccount"("customerId");

-- CreateIndex
CREATE INDEX "ClientFinishedGoodsItem_customerId_isDeleted_idx" ON "ClientFinishedGoodsItem"("customerId", "isDeleted");

-- CreateIndex
CREATE INDEX "ClientFinishedGoodsItem_productId_idx" ON "ClientFinishedGoodsItem"("productId");

-- CreateIndex
CREATE INDEX "ClientStockMovement_itemId_createdAt_idx" ON "ClientStockMovement"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientNotification_clientAccountId_isRead_createdAt_idx" ON "ClientNotification"("clientAccountId", "isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFinishedGoodsItem" ADD CONSTRAINT "ClientFinishedGoodsItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFinishedGoodsItem" ADD CONSTRAINT "ClientFinishedGoodsItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStockMovement" ADD CONSTRAINT "ClientStockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClientFinishedGoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStockMovement" ADD CONSTRAINT "ClientStockMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStockMovement" ADD CONSTRAINT "ClientStockMovement_actorClientAccountId_fkey" FOREIGN KEY ("actorClientAccountId") REFERENCES "ClientAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNotification" ADD CONSTRAINT "ClientNotification_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
