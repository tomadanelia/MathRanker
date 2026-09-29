import { describe, expect, it } from "vitest";
import { createBotPlan, pickBotDisplayName } from "../src/lib/game/bot";

describe("pickBotDisplayName", () => {
  it("returns a believable username", () => {
    expect(pickBotDisplayName()).toMatch(/^[a-z0-9_]+$/);
  });
});

describe("createBotPlan", () => {
  it("approximates target accuracy and respects timing bounds", () => {
    const plan = createBotPlan({
      questionCount: 10000,
      secondsPerQuestion: 30,
      accuracy: 0.7,
      botRating: 1500,
      difficulty: 1600,
    });

    const accuracy =
      plan.filter((entry) => entry.willBeCorrect).length / plan.length;

    expect(plan).toHaveLength(10000);
    expect(accuracy).toBeGreaterThan(0.68);
    expect(accuracy).toBeLessThan(0.72);
    expect(
      plan.every(
        (entry) =>
          entry.respondAfterMs >= 1500 && entry.respondAfterMs <= 30000,
      ),
    ).toBe(true);
  });
});
