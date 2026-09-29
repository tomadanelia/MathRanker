import { describe, expect, it } from "vitest";
import { computeNewRating } from "../src/lib/ratings/glicko";

describe("computeNewRating", () => {
  it("win raises rating and reduces rd for a new player", () => {
    const before = { rating: 1500, rd: 200, vol: 0.06 };
    const after = computeNewRating(before, [
      { rating: 1400, rd: 30, score: 1 },
    ]);

    expect(after.rating).toBeGreaterThan(before.rating);
    expect(after.rd).toBeLessThan(before.rd);
  });

  it("loss lowers rating for a strong player", () => {
    const before = { rating: 1700, rd: 50, vol: 0.06 };
    const after = computeNewRating(before, [
      { rating: 1800, rd: 40, score: 0 },
    ]);

    expect(after.rating).toBeLessThan(before.rating);
  });

  it("draw vs equal player is near neutral and rd shrinks", () => {
    const before = { rating: 1500, rd: 80, vol: 0.06 };
    const after = computeNewRating(before, [
      { rating: 1500, rd: 80, score: 0.5 },
    ]);

    expect(Math.abs(after.rating - before.rating)).toBeLessThan(20);
    expect(after.rd).toBeLessThan(before.rd);
  });

  it("new players move more than established players", () => {
    const newPlayer = computeNewRating({ rating: 1500, rd: 200, vol: 0.06 }, [
      { rating: 1400, rd: 30, score: 1 },
    ]);
    const established = computeNewRating({ rating: 1500, rd: 30, vol: 0.06 }, [
      { rating: 1400, rd: 30, score: 1 },
    ]);

    expect(newPlayer.rating - 1500).toBeGreaterThan(established.rating - 1500);
  });
});
