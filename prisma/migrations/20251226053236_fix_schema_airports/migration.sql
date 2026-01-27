/*
  Warnings:

  - You are about to drop the column `city` on the `Airport` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Airport` table. All the data in the column will be lost.
  - You are about to drop the column `iata` on the `Airport` table. All the data in the column will be lost.
  - You are about to drop the column `ranking` on the `Airport` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Airport` table. All the data in the column will be lost.
  - Added the required column `cityId` to the `Airport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `Airport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Airport` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Airport_city_idx";

-- DropIndex
DROP INDEX "Airport_iata_idx";

-- DropIndex
DROP INDEX "Airport_iata_key";

-- DropIndex
DROP INDEX "Airport_name_idx";

-- AlterTable
ALTER TABLE "Airport" DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "iata",
DROP COLUMN "ranking",
DROP COLUMN "type",
ADD COLUMN     "cityId" TEXT NOT NULL,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isMajor" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City"("name");

-- CreateIndex
CREATE INDEX "Airport_cityId_idx" ON "Airport"("cityId");

-- CreateIndex
CREATE INDEX "Airport_code_idx" ON "Airport"("code");

-- AddForeignKey
ALTER TABLE "Airport" ADD CONSTRAINT "Airport_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
