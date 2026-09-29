import { describe, expect, it } from "vitest";
import {
  answerRequestSchema,
  matchmakingJoinSchema,
} from "../src/lib/api/schemas";

describe("matchmakingJoinSchema", () => {
  it("accepts supported presets and category slugs", () => {
    expect(
      matchmakingJoinSchema.safeParse({
        category: "mixed",
        preset: "blitz",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown presets and malformed category slugs", () => {
    expect(
      matchmakingJoinSchema.safeParse({
        category: "mixed;drop-table",
        preset: "rapid",
      }).success,
    ).toBe(false);
  });
});

describe("answerRequestSchema", () => {
  it("accepts an answer for a nonnegative question position", () => {
    expect(
      answerRequestSchema.safeParse({ position: 0, answer: "1/2" }).success,
    ).toBe(true);
  });

  it("rejects invalid positions and oversized answers", () => {
    expect(
      answerRequestSchema.safeParse({ position: -1, answer: "42" }).success,
    ).toBe(false);
    expect(
      answerRequestSchema.safeParse({ position: 0, answer: "x".repeat(51) })
        .success,
    ).toBe(false);
  });
});
