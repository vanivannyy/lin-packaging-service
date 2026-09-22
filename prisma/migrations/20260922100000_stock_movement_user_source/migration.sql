-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'WEB';
ALTER TABLE "StockMovement" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_referenceCode_idx" ON "StockMovement"("referenceCode");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
