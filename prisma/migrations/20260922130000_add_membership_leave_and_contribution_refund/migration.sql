-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "leftAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN "refundedAt" TIMESTAMP(3);
