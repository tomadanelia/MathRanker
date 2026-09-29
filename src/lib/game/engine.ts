export type Side = "a" | "b";
export type GameStatus = "active" | "finished" | "abandoned";

export type QuestionMove = {
  answered: boolean;
  correct: boolean;
  answer: string | null;
  timeTakenMs: number;
  submittedAtMs: number | null;
};

export type GameState = {
  id: string;
  status: GameStatus;
  questionCount: number;
  secondsPerQuestion: number;
  currentPosition: number;
  questionStartedAtMs: number;
  winner: "a" | "b" | "draw" | null;
  scoreA: number;
  scoreB: number;
  moves: {
    a?: QuestionMove;
    b?: QuestionMove;
  };
  timeA: number;
  timeB: number;
  finishedAtMs: number | null;
};

export type SubmitAnswerInput = {
  game: GameState;
  side: Side;
  answer: string;
  nowMs: number;
  checkAnswer: (value: string) => boolean;
};

export type FinalizeGameInput = {
  game: GameState;
  winner: "a" | "b" | "draw";
  scoreA: number;
  scoreB: number;
  timeA: number;
  timeB: number;
};

export function createGame({
  questionCount,
  secondsPerQuestion,
  startAtMs,
}: {
  questionCount: number;
  secondsPerQuestion: number;
  startAtMs: number;
}): GameState {
  return {
    id: "game-1",
    status: "active",
    questionCount,
    secondsPerQuestion,
    currentPosition: 0,
    questionStartedAtMs: startAtMs,
    winner: null,
    scoreA: 0,
    scoreB: 0,
    moves: {},
    timeA: 0,
    timeB: 0,
    finishedAtMs: null,
  };
}

export function resolveWinner({
  scoreA,
  scoreB,
  timeA,
  timeB,
}: {
  scoreA: number;
  scoreB: number;
  timeA: number;
  timeB: number;
}): "a" | "b" | "draw" {
  if (scoreA > scoreB) return "a";
  if (scoreB > scoreA) return "b";
  if (timeA < timeB) return "a";
  if (timeB < timeA) return "b";
  return "draw";
}

export function finalizeGame({
  game,
  winner,
  scoreA,
  scoreB,
  timeA,
  timeB,
}: FinalizeGameInput): { game: GameState; result: { noOp: boolean } } {
  if (game.status === "finished") {
    return { game, result: { noOp: true } };
  }

  const finalized: GameState = {
    ...game,
    status: "finished",
    winner,
    scoreA,
    scoreB,
    timeA,
    timeB,
    finishedAtMs: Date.now(),
  };

  return { game: finalized, result: { noOp: false } };
}

export function submitAnswer({
  game,
  side,
  answer,
  nowMs,
  checkAnswer,
}: SubmitAnswerInput): {
  game: GameState;
  result: { accepted: boolean; timeExpired: boolean; gameFinished: boolean };
} {
  if (game.status !== "active") {
    return {
      game,
      result: {
        accepted: false,
        timeExpired: false,
        gameFinished: game.status === "finished",
      },
    };
  }

  const questionDeadlineMs =
    game.questionStartedAtMs + game.secondsPerQuestion * 1000;
  const isLate = nowMs > questionDeadlineMs;
  const existing = game.moves[side];

  if (existing?.answered) {
    return {
      game,
      result: { accepted: false, timeExpired: false, gameFinished: false },
    };
  }

  const correct = !isLate && checkAnswer(answer);
  const timeTakenMs = Math.min(
    Math.max(nowMs - game.questionStartedAtMs, 0),
    game.secondsPerQuestion * 1000,
  );

  const move: QuestionMove = {
    answered: true,
    correct,
    answer: isLate ? null : answer,
    timeTakenMs: isLate ? game.secondsPerQuestion * 1000 : timeTakenMs,
    submittedAtMs: nowMs,
  };

  const nextGame: GameState = {
    ...game,
    moves: {
      ...game.moves,
      [side]: move,
    },
  };

  if (isLate) {
    nextGame.moves[side] = { ...move, correct: false, answer: null };
  }

  const bothAnswered =
    Boolean(nextGame.moves.a?.answered) && Boolean(nextGame.moves.b?.answered);

  if (bothAnswered) {
    const scoreA = Number(Boolean(nextGame.moves.a?.correct)) + game.scoreA;
    const scoreB = Number(Boolean(nextGame.moves.b?.correct)) + game.scoreB;
    const timeA =
      game.timeA +
      (nextGame.moves.a?.correct ? nextGame.moves.a.timeTakenMs : 0);
    const timeB =
      game.timeB +
      (nextGame.moves.b?.correct ? nextGame.moves.b.timeTakenMs : 0);

    if (game.currentPosition + 1 < game.questionCount) {
      const advancedGame: GameState = {
        ...nextGame,
        currentPosition: game.currentPosition + 1,
        questionStartedAtMs: nowMs,
        moves: {},
        scoreA,
        scoreB,
        timeA,
        timeB,
      };

      return {
        game: advancedGame,
        result: {
          accepted: true,
          timeExpired: isLate,
          gameFinished: false,
        },
      };
    }

    const winner = resolveWinner({ scoreA, scoreB, timeA, timeB });
    const finished: GameState = {
      ...nextGame,
      status: "finished",
      winner,
      scoreA,
      scoreB,
      timeA,
      timeB,
      finishedAtMs: nowMs,
      currentPosition: game.currentPosition + 1,
    };

    return {
      game: finished,
      result: {
        accepted: true,
        timeExpired: isLate,
        gameFinished: true,
      },
    };
  }

  return {
    game: nextGame,
    result: {
      accepted: true,
      timeExpired: isLate,
      gameFinished: false,
    },
  };
}
