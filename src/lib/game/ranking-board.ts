import type { TimeControl } from "./time-controls";
import { categoryRatingOffsets, sampleLeaderboards } from "./sample-leaderboard";

export type RankingRow = {
  username: string;
  rating: number;
  isPlayer: boolean;
  beforeRank: number;
  afterRank: number;
};

export function buildRankingBoard({
  preset,
  category,
  username,
  ratingBefore,
  ratingAfter,
}: {
  preset: TimeControl;
  category: string;
  username: string;
  ratingBefore: number;
  ratingAfter: number;
}): RankingRow[] {
  const offset = categoryRatingOffsets[category] ?? 0;
  const opponents = sampleLeaderboards[preset].map((entry) => ({
    username: entry.username,
    rating: entry.rating + offset,
    isPlayer: false,
  }));
  const before = [...opponents, { username, rating: ratingBefore, isPlayer: true }]
    .sort((a, b) => b.rating - a.rating);
  const after = [...opponents, { username, rating: ratingAfter, isPlayer: true }]
    .sort((a, b) => b.rating - a.rating);

  return after.map((entry, index) => ({
    ...entry,
    beforeRank: before.findIndex((candidate) => candidate.isPlayer === entry.isPlayer && candidate.username === entry.username) + 1,
    afterRank: index + 1,
  }));
}
