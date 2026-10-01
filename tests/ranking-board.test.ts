import { describe, expect, it } from "vitest";
import { buildRankingBoard } from "../src/lib/game/ranking-board";

const setup = {
  preset: "blitz" as const,
  username: "current_player",
};

describe("demo ranking board", () => {
  it.each([
    [1500, 1500], [1500, 1500.1], [1500, 1540], [3000, 3300], [100, 101],
  ])("guarantees a win climb with real ratings %s -> %s", (ratingBefore, ratingAfter) => {
    const rows = buildRankingBoard({ ...setup, ratingBefore, ratingAfter, outcome: "win" });
    const player = rows.find((row) => row.isPlayer)!;
    const crossed = rows.filter((row) => !row.isPlayer && row.beforeRank !== row.afterRank);

    expect(player).toMatchObject({ beforeRank: 5780, afterRank: 5768, rating: ratingAfter });
    expect(player.beforeRank - player.afterRank).toBeGreaterThanOrEqual(10);
    expect(crossed).toHaveLength(12);
    expect(crossed.every((row) => row.afterRank === row.beforeRank + 1)).toBe(true);
    expect(rows.filter((row) => row.beforeRank < player.beforeRank).length).toBeGreaterThanOrEqual(12);
    expect(rows.filter((row) => row.beforeRank > player.beforeRank)).toHaveLength(3);
  });

  it("generates stable opponents relative to the real starting rating", () => {
    const input = { ...setup, ratingBefore: 1800, ratingAfter: 1801, outcome: "win" as const };
    const rows = buildRankingBoard(input);
    expect(buildRankingBoard(input)).toEqual(rows);
    expect(new Set(rows.filter((row) => !row.isPlayer).map((row) => row.username)).size).toBe(rows.length - 1);
    for (const row of rows.filter((row) => !row.isPlayer)) {
      expect(row.rating).toBe(1800 + (5780 - row.beforeRank) * 5);
    }
  });

  it.each(["win", "loss", "draw"] as const)("keeps ranks contiguous and unique for a %s", (outcome) => {
    const rows = buildRankingBoard({ ...setup, ratingBefore: 1500, ratingAfter: 1501, outcome });
    const finalRanks = rows.map((row) => row.afterRank);
    expect(finalRanks).toEqual(rows.map((_, index) => finalRanks[0] + index));
    expect([...rows.map((row) => row.beforeRank)].sort((a, b) => a - b)).toEqual(finalRanks);
    expect(rows.filter((row) => row.isPlayer)).toHaveLength(1);
  });

  it("uses the match outcome rather than the sign of the rating delta", () => {
    const loss = buildRankingBoard({ ...setup, ratingBefore: 1500, ratingAfter: 1501, outcome: "loss" });
    expect(loss.find((row) => row.isPlayer)).toMatchObject({ beforeRank: 5780, afterRank: 5782, rating: 1501 });
    const draw = buildRankingBoard({ ...setup, ratingBefore: 1500, ratingAfter: 1505, outcome: "draw" });
    expect(draw.every((row) => row.beforeRank === row.afterRank)).toBe(true);
    expect(draw.find((row) => row.isPlayer)?.rating).toBe(1505);
  });
});
