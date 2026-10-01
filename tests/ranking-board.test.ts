import { describe, expect, it } from "vitest";
import { buildRankingBoard } from "../src/lib/game/ranking-board";

const setup = {
  preset: "blitz" as const,
  category: "arithmetic",
  username: "current_player",
};

describe("buildRankingBoard", () => {
  it("moves the player above crossed opponents after a gain", () => {
    const rows = buildRankingBoard({ ...setup, ratingBefore: 1500, ratingAfter: 1540 });
    const player = rows.find((row) => row.isPlayer);
    const crossed = rows.filter((row) => row.beforeRank !== row.afterRank && !row.isPlayer);

    expect(player).toMatchObject({ beforeRank: 6, afterRank: 4, rating: 1540 });
    expect(crossed.map((row) => row.username)).toEqual(["quickquotient", "digitdash"]);
    expect(crossed.every((row) => row.afterRank === row.beforeRank + 1)).toBe(true);
  });

  it("moves the player below crossed opponents after a loss", () => {
    const rows = buildRankingBoard({ ...setup, ratingBefore: 1500, ratingAfter: 1450 });
    const player = rows.find((row) => row.isPlayer);
    const crossed = rows.filter((row) => row.beforeRank !== row.afterRank && !row.isPlayer);

    expect(player).toMatchObject({ beforeRank: 6, afterRank: 8, rating: 1450 });
    expect(crossed.map((row) => row.username)).toEqual(["factorflash", "rootrunner"]);
    expect(crossed.every((row) => row.afterRank === row.beforeRank - 1)).toBe(true);
  });

  it("keeps every row in place when no opponent is crossed", () => {
    const rows = buildRankingBoard({ ...setup, ratingBefore: 1500, ratingAfter: 1505 });
    expect(rows.every((row) => row.beforeRank === row.afterRank)).toBe(true);
  });
});
