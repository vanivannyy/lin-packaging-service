-- CreateEnum
CREATE TYPE "SalesOrderMaterialStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

-- CreateTable
CREATE TABLE "SalesOrderMaterial" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "qty" DECIMAL(15,3) NOT NULL,
    "reservedQty" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "status" "SalesOrderMaterialStatus" NOT NULL DEFAULT 'RESERVED',
    "source" TEXT NOT NULL DEFAULT 'HPP',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesOrderMaterial_salesOrderId_idx" ON "SalesOrderMaterial"("salesOrderId");
CREATE INDEX "SalesOrderMaterial_materialId_status_idx" ON "SalesOrderMaterial"("materialId", "status");

-- AddForeignKey
ALTER TABLE "SalesOrderMaterial" ADD CONSTRAINT "SalesOrderMaterial_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderMaterial" ADD CONSTRAINT "SalesOrderMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrasi data dari kolom reservasi tunggal (migrasi 20261120100000): hanya yang masih direservasi.
INSERT INTO "SalesOrderMaterial" ("id", "salesOrderId", "materialId", "qty", "reservedQty", "status", "source", "updatedAt")
SELECT 'som_' || "id", "id", "materialId", "materialReservedQty", "materialReservedQty", 'RESERVED', 'HPP', CURRENT_TIMESTAMP
FROM "SalesOrder"
WHERE "materialId" IS NOT NULL AND "materialReservedQty" > 0;

-- DropForeignKey / DropColumn
ALTER TABLE "SalesOrder" DROP CONSTRAINT "SalesOrder_materialId_fkey";
ALTER TABLE "SalesOrder" DROP COLUMN "materialId";
ALTER TABLE "SalesOrder" DROP COLUMN "materialReservedQty";
