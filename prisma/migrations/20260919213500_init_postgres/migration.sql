-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('OPEN', 'EXECUTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayoutType" AS ENUM ('USDC', 'TTOKEN');

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetTokenMint" TEXT NOT NULL,
    "targetTokenSymbol" TEXT NOT NULL,
    "clubWalletAddress" TEXT NOT NULL,
    "clubWalletPrivateKeyEncrypted" TEXT NOT NULL,
    "fundingGoalUsd" DOUBLE PRECISION,
    "inviteCode" TEXT NOT NULL,
    "status" "ClubStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "amountUsdc" DOUBLE PRECISION NOT NULL,
    "txSignature" TEXT NOT NULL,
    "contributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionId" TEXT,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "totalUsdcAmount" DOUBLE PRECISION NOT NULL,
    "tTokenAmountReceived" DOUBLE PRECISION NOT NULL,
    "txSignature" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotePriceImpactPct" DOUBLE PRECISION NOT NULL,
    "individualEstimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "clubActualCostUsd" DOUBLE PRECISION NOT NULL,
    "savingsUsd" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exit" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "proportionShare" DOUBLE PRECISION NOT NULL,
    "payoutType" "PayoutType" NOT NULL,
    "payoutAmount" DOUBLE PRECISION NOT NULL,
    "txSignature" TEXT NOT NULL,
    "exitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_clubWalletAddress_key" ON "Club"("clubWalletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Club_inviteCode_key" ON "Club"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_clubId_walletAddress_key" ON "Membership"("clubId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_txSignature_key" ON "Contribution"("txSignature");

-- CreateIndex
CREATE UNIQUE INDEX "Execution_txSignature_key" ON "Execution"("txSignature");

-- CreateIndex
CREATE UNIQUE INDEX "Exit_txSignature_key" ON "Exit"("txSignature");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exit" ADD CONSTRAINT "Exit_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exit" ADD CONSTRAINT "Exit_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

