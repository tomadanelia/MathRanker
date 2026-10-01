import type { TimeControl } from "./time-controls";
import { sampleLeaderboards } from "./sample-leaderboard";

export type RankingRow = {
  username: string;
  rating: number;
  isPlayer: boolean;
  beforeRank: number;
  afterRank: number;
};

// Presentation-only demo ranks. Never use these to update a player's rating.
const START_RANK = 5780;
const PLAYERS_ABOVE = 24;
const PLAYERS_BELOW = 3;
const WIN_CLIMB = 12;

export function buildRankingBoard({
  preset,
  username,
  ratingBefore,
  ratingAfter,
  outcome,
}: {
  preset: TimeControl;
  username: string;
  ratingBefore: number;
  ratingAfter: number;
  outcome: "win" | "loss" | "draw";
}): RankingRow[] {
  const rankChange = outcome === "win" ? WIN_CLIMB : outcome === "loss" ? -2 : 0;
  const finalRank = START_RANK - rankChange;
  const names = sampleLeaderboards[preset];
  const rows: RankingRow[] = [];

  for (let rank = START_RANK - PLAYERS_ABOVE; rank <= START_RANK + PLAYERS_BELOW; rank++) {
    if (rank === START_RANK) {
      rows.push({ username, rating: ratingAfter, isPlayer: true, beforeRank: rank, afterRank: finalRank });
      continue;
    }
    const index = rank - (START_RANK - PLAYERS_ABOVE);
    const crossed = rankChange > 0
      ? rank >= finalRank && rank < START_RANK
      : rank > START_RANK && rank <= finalRank;
    rows.push({
      username: `${names[index % names.length].username}_${index + 1}`,
      rating: Math.max(0, Math.round(ratingBefore + (START_RANK - rank) * 5)),
      isPlayer: false,
      beforeRank: rank,
      afterRank: rank + (crossed ? Math.sign(rankChange) : 0),
    });
  }

  // Keep a stable sequence for the window moving behind the fixed player row.
  return rows;
}
