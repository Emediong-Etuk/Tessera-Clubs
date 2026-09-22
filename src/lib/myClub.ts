// Shared shape of a row from GET /api/clubs/mine -- used by both the
// active-clubs list (/clubs/mine) and the left-clubs history page
// (/clubs/history), which are really two filtered views of the same data.
export interface MyClub {
  inviteCode: string;
  name: string;
  status: "OPEN" | "EXECUTED" | "CLOSED";
  targetTokenSymbol: string;
  fundingGoalUsd: number | null;
  createdAt: string;
  joinedAt: string;
  isCreator: boolean;
  pendingPoolUsdc: number;
  myContributedUsdc: number;
  hasExited: boolean;
  hasExecutedPosition: boolean;
  executionCount: number;
  leftAt: string | null;
  refundedUsdc: number;
  exit: {
    payoutType: "USDC" | "TTOKEN";
    payoutAmount: number;
    txSignature: string;
    exitedAt: string;
  } | null;
}
