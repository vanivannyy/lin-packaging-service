-- AlterTable
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ClientAccount" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
