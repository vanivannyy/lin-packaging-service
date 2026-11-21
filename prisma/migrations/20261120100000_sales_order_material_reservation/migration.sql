-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN "materialId" TEXT;
ALTER TABLE "SalesOrder" ADD COLUMN "materialReservedQty" DECIMAL(15,3) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
