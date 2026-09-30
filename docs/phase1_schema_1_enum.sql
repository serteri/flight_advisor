-- Step 1 of 2. Run ALONE, outside any transaction, before step 2.
-- (ALTER TYPE ... ADD VALUE cannot share a transaction with statements that use the new value.)
-- AlterEnum
ALTER TYPE "TripStatus" ADD VALUE 'PENDING_CONFIRMATION';
