import { describe, expect, it } from "vitest";
import { checkAnswer, normalizeNumericAnswer } from "../src/lib/answers/check";

describe("normalizeNumericAnswer", () => {
  it("normalizes common numeric inputs and fractions", () => {
    expect(normalizeNumericAnswer(" 1/2 ")).toBe("0.5");
    expect(normalizeNumericAnswer("0.5")).toBe("0.5");
    expect(normalizeNumericAnswer(".5")).toBe("0.5");
    expect(normalizeNumericAnswer("2/4")).toBe("0.5");
    expect(normalizeNumericAnswer("1,5")).toBe("1.5");
    expect(normalizeNumericAnswer("−3")).toBe("-3");
  });

  it("rejects invalid values safely", () => {
    expect(normalizeNumericAnswer("nan")).toBeNull();
    expect(normalizeNumericAnswer("infinity")).toBeNull();
    expect(normalizeNumericAnswer("abc")).toBeNull();
  });
});

describe("checkAnswer", () => {
  it("accepts equivalent numeric values within tolerance", () => {
    expect(checkAnswer("numeric", "1/2", { answer: "0.5", tolerance: 0 })).toBe(
      true,
    );
    expect(
      checkAnswer("numeric", "0.75", { answer: "3/4", tolerance: 0 }),
    ).toBe(true);
    expect(
      checkAnswer("numeric", "2.3", { answer: "2.31", tolerance: 0.02 }),
    ).toBe(true);
  });

  it("accepts accepted answer aliases and rejects garbage", () => {
    expect(
      checkAnswer("numeric", "3", {
        answer: "3",
        acceptedAnswers: ["3.0", "03"],
        tolerance: 0,
      }),
    ).toBe(true);
    expect(
      checkAnswer("numeric", "3", {
        answer: "4",
        acceptedAnswers: ["3.0"],
        tolerance: 0,
      }),
    ).toBe(false);
    expect(checkAnswer("numeric", "abc", { answer: "1", tolerance: 0 })).toBe(
      false,
    );
  });

  it("matches multiple choice selection by id exactly", () => {
    expect(
      checkAnswer("multiple_choice", "b", {
        answer: "b",
        choices: [{ id: "a" }, { id: "b" }],
      }),
    ).toBe(true);
    expect(
      checkAnswer("multiple_choice", "b", {
        answer: "a",
        choices: [{ id: "a" }, { id: "b" }],
      }),
    ).toBe(false);
  });
});
