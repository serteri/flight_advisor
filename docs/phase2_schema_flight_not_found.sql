-- Phase 2 schema: flight validation (FLIGHT_NOT_FOUND).
-- NOT APPLIED. Generated with prisma migrate diff from origin/main:prisma/schema.prisma.
-- Run ALONE, outside any transaction (ALTER TYPE ... ADD VALUE), BEFORE deploying
-- the code that writes this status. Additive only; no data change.
-- AlterEnum
ALTER TYPE "TripStatus" ADD VALUE 'FLIGHT_NOT_FOUND';

