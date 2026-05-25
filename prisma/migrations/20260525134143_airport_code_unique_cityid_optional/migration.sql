/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Airport` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Airport_code_idx";

-- AlterTable
ALTER TABLE "Airport" ALTER COLUMN "cityId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Airport_code_key" ON "Airport"("code");
