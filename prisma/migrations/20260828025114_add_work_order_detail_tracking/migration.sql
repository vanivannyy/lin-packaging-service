-- CreateEnum
CREATE TYPE "WorkOrderStepStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'DONE');

-- AlterEnum
ALTER TYPE "WorkOrderProcess" ADD VALUE 'LAMINATING';

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "materialSpec" JSONB;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "goodQtyTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectQtyTotal" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WorkOrderStepProgress" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "process" "WorkOrderProcess" NOT NULL,
    "status" "WorkOrderStepStatus" NOT NULL DEFAULT 'WAITING',
    "goodQty" INTEGER NOT NULL DEFAULT 0,
    "rejectQty" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderStepProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderProductionLog" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "process" "WorkOrderProcess",
    "goodQty" INTEGER NOT NULL DEFAULT 0,
    "rejectQty" INTEGER NOT NULL DEFAULT 0,
    "downtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderProductionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderQcCheck" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "passed" BOOLEAN,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderQcCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderStepProgress_workOrderId_idx" ON "WorkOrderStepProgress"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderStepProgress_workOrderId_process_key" ON "WorkOrderStepProgress"("workOrderId", "process");

-- CreateIndex
CREATE INDEX "WorkOrderProductionLog_workOrderId_createdAt_idx" ON "WorkOrderProductionLog"("workOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkOrderQcCheck_workOrderId_checkType_idx" ON "WorkOrderQcCheck"("workOrderId", "checkType");

-- AddForeignKey
ALTER TABLE "WorkOrderStepProgress" ADD CONSTRAINT "WorkOrderStepProgress_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderProductionLog" ADD CONSTRAINT "WorkOrderProductionLog_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderProductionLog" ADD CONSTRAINT "WorkOrderProductionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderQcCheck" ADD CONSTRAINT "WorkOrderQcCheck_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderQcCheck" ADD CONSTRAINT "WorkOrderQcCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
