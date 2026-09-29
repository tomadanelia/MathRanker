import { describe, expect, it } from "vitest";
import {
  createGame,
  finalizeGame,
  resolveWinner,
  submitAnswer,
} from "../src/lib/game/engine";

describe("resolveWinner", () => {
  it("uses lower total correct-answer time as tie-break", () => {
    expect(
      resolveWinner({ scoreA: 2, scoreB: 2, timeA: 12000, timeB: 8000 }),
    ).toBe("b");
    expect(
      resolveWinner({ scoreA: 2, scoreB: 2, timeA: 7000, timeB: 9000 }),
    ).toBe("a");
    expect(
      resolveWinner({ scoreA: 2, scoreB: 2, timeA: 9000, timeB: 9000 }),
    ).toBe("draw");
  });
});

describe("submitAnswer", () => {
  it("rejects duplicate submissions and treats late answers as timeouts", () => {
    const game = createGame({
      questionCount: 1,
      secondsPerQuestion: 10,
      startAtMs: 0,
    });

    const first = submitAnswer({
      game,
      side: "a",
      answer: "42",
      nowMs: 2000,
      checkAnswer: (value) => value === "42",
    });

    expect(first.result.accepted).toBe(true);

    const duplicate = submitAnswer({
      game: first.game,
      side: "a",
      answer: "99",
      nowMs: 3000,
      checkAnswer: () => false,
    });

    expect(duplicate.result.accepted).toBe(false);

    const late = submitAnswer({
      game: first.game,
      side: "b",
      answer: "anything",
      nowMs: 15000,
      checkAnswer: () => false,
    });

    expect(late.result.timeExpired).toBe(true);
    expect(late.game.moves.b?.correct).toBe(false);
  });

  it("finishes the game when both sides have answered", () => {
    const game = createGame({
      questionCount: 1,
      secondsPerQuestion: 10,
      startAtMs: 0,
    });

    const a = submitAnswer({
      game,
      side: "a",
      answer: "2",
      nowMs: 1000,
      checkAnswer: (value) => value === "2",
    });

    const b = submitAnswer({
      game: a.game,
      side: "b",
      answer: "3",
      nowMs: 1500,
      checkAnswer: (value) => value === "2",
    });

    expect(b.result.gameFinished).toBe(true);
    expect(b.game.status).toBe("finished");
    expect(b.game.winner).toBe("a");
  });

  it("advances to the next question until the configured count is reached", () => {
    const game = createGame({
      questionCount: 2,
      secondsPerQuestion: 10,
      startAtMs: 0,
    });

    const firstAnswer = submitAnswer({
      game,
      side: "a",
      answer: "2",
      nowMs: 1000,
      checkAnswer: (value) => value === "2",
    });
    const firstRound = submitAnswer({
      game: firstAnswer.game,
      side: "b",
      answer: "3",
      nowMs: 1500,
      checkAnswer: (value) => value === "2",
    });

    expect(firstRound.result.gameFinished).toBe(false);
    expect(firstRound.game.status).toBe("active");
    expect(firstRound.game.currentPosition).toBe(1);
    expect(firstRound.game.moves).toEqual({});
    expect(firstRound.game.scoreA).toBe(1);

    const secondAnswer = submitAnswer({
      game: firstRound.game,
      side: "a",
      answer: "4",
      nowMs: 2500,
      checkAnswer: (value) => value === "4",
    });
    const secondRound = submitAnswer({
      game: secondAnswer.game,
      side: "b",
      answer: "5",
      nowMs: 3000,
      checkAnswer: (value) => value === "4",
    });

    expect(secondRound.result.gameFinished).toBe(true);
    expect(secondRound.game.status).toBe("finished");
    expect(secondRound.game.scoreA).toBe(2);
    expect(secondRound.game.winner).toBe("a");
  });

  it("finalizing twice is a no-op", () => {
    const game = createGame({
      questionCount: 1,
      secondsPerQuestion: 10,
      startAtMs: 0,
    });

    const once = finalizeGame({
      game,
      winner: "a",
      scoreA: 1,
      scoreB: 0,
      timeA: 1000,
      timeB: 2000,
    });

    const twice = finalizeGame({
      game: once.game,
      winner: "b",
      scoreA: 0,
      scoreB: 1,
      timeA: 3000,
      timeB: 1000,
    });

    expect(twice.game.status).toBe("finished");
    expect(twice.game.winner).toBe("a");
    expect(twice.result.noOp).toBe(true);
  });
});
