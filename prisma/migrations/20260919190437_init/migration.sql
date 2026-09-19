-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "targetTokenMint" TEXT NOT NULL,
    "targetTokenSymbol" TEXT NOT NULL,
    "clubWalletAddress" TEXT NOT NULL,
    "clubWalletPrivateKeyEncrypted" TEXT NOT NULL,
    "fundingGoalUsd" REAL,
    "inviteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "amountUsdc" REAL NOT NULL,
    "txSignature" TEXT NOT NULL,
    "contributedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionId" TEXT,
    CONSTRAINT "Contribution_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contribution_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contribution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "totalUsdcAmount" REAL NOT NULL,
    "tTokenAmountReceived" REAL NOT NULL,
    "txSignature" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotePriceImpactPct" REAL NOT NULL,
    "individualEstimatedCostUsd" REAL NOT NULL,
    "clubActualCostUsd" REAL NOT NULL,
    "savingsUsd" REAL NOT NULL,
    CONSTRAINT "Execution_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "proportionShare" REAL NOT NULL,
    "payoutType" TEXT NOT NULL,
    "payoutAmount" REAL NOT NULL,
    "txSignature" TEXT NOT NULL,
    "exitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exit_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Exit_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
