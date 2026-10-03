-- Phase 2 schema: flight validation (FLIGHT_NOT_FOUND, PENDING_VERIFICATION).
-- NOT APPLIED. Matches `prisma migrate diff` from origin/main:prisma/schema.prisma.
--
-- Two statements. Run EACH ONE SEPARATELY, outside any transaction
-- (ALTER TYPE ... ADD VALUE), BEFORE deploying the code that writes these
-- statuses. Additive only; no data change. Either can be re-run safely after
-- checking the value is absent (an existing value makes ADD VALUE fail).

-- 1/2
ALTER TYPE "TripStatus" ADD VALUE 'FLIGHT_NOT_FOUND';

-- 2/2
ALTER TYPE "TripStatus" ADD VALUE 'PENDING_VERIFICATION';
