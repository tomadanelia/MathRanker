"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api } from "../../../src/lib/api/client";
import {
  timeControls,
  type TimeControl,
} from "../../../src/lib/game/time-controls";
import { useAvatar, usePlayer } from "../../components/player-profile";
import ResultLeaderboard from "./result-leaderboard";
import { prepareRankingSound } from "../../../src/lib/game/ranking-sound";

type GameSnapshot = {
  game: {
    id: string;
    category: string;
    preset: TimeControl;
    status: string;
    side: "a" | "b";
    isBot: boolean;
    opponentName: string | null;
    opponentRating: number | null;
    currentPosition: number;
    questionCount: number;
    secondsPerQuestion: number;
    questionStartedAt: string | null;
    winner: "a" | "b" | "draw" | null;
    scoreA: number | null;
    scoreB: number | null;
    ratingBefore: number | null;
    ratingAfter: number | null;
  };
  question?: {
    id: string;
    body: string;
    type: "numeric" | "multiple_choice";
    choices: Array<{ id: string; text?: string }> | null;
    imageUrl: string | null;
  };
  answerStatus?: { a: boolean; b: boolean };
};

export default function GameScreen({ gameId }: { gameId: string }) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [draft, setDraft] = useState({ position: -1, value: "" });
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = usePlayer();
  const avatar = useAvatar(player?.id);
  const autoTimeoutPosition = useRef<number | null>(null);
  const game = snapshot?.game;
  const alreadyAnswered = Boolean(game && snapshot?.answerStatus?.[game.side]);
  const answer = draft.position === game?.currentPosition ? draft.value : "";

  useEffect(() => {
    window.addEventListener("pointerdown", prepareRankingSound);
    window.addEventListener("keydown", prepareRankingSound);
    return () => {
      window.removeEventListener("pointerdown", prepareRankingSound);
      window.removeEventListener("keydown", prepareRankingSound);
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await api.get<GameSnapshot>(`/games/${gameId}`);
    setSnapshot(next);
  }, [gameId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await api.get<GameSnapshot>(`/games/${gameId}`);
        if (active) {
          setSnapshot(next);
          setError(null);
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load game.",
          );
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 1300);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [gameId]);

  useEffect(() => {
    const startedAt = snapshot?.game.questionStartedAt;
    const duration = snapshot?.game.secondsPerQuestion ?? 0;
    if (!startedAt || snapshot?.game.status !== "active") return;
    const update = () => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      setRemaining(Math.max(0, Math.ceil(duration - elapsed)));
    };
    update();
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [
    snapshot?.game.questionStartedAt,
    snapshot?.game.secondsPerQuestion,
    snapshot?.game.status,
  ]);

  useEffect(() => {
    const startedAt = game?.questionStartedAt;
    if (
      !game ||
      game.status !== "active" ||
      !startedAt ||
      remaining > 0 ||
      alreadyAnswered ||
      busy ||
      Date.now() <
        new Date(startedAt).getTime() + game.secondsPerQuestion * 1000 ||
      autoTimeoutPosition.current === game.currentPosition
    ) {
      return;
    }

    autoTimeoutPosition.current = game.currentPosition;
    setBusy(true);
    setError(null);
    void api
      .post(`/games/${gameId}/answer`, {
        position: game.currentPosition,
        answer: "",
      })
      .then(refresh)
      .catch((cause: unknown) => {
        autoTimeoutPosition.current = null;
        setError(
          cause instanceof Error ? cause.message : "Could not record timeout.",
        );
      })
      .finally(() => setBusy(false));
  }, [alreadyAnswered, busy, game, gameId, refresh, remaining]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !answer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/games/${gameId}/answer`, {
        position: snapshot.game.currentPosition,
        answer: answer.trim(),
      });
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not submit answer.",
      );
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const score = game ? `${game.scoreA ?? 0} — ${game.scoreB ?? 0}` : "—";

  if (!snapshot && !error) {
    return (
      <main className="game-shell">
        <div className="game-loading">
          Loading your round
          <span className="loading-line" />
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="game-shell">
        <p className="inline-error">{error}</p>
        <Link className="text-button" href="/">
          Back to lobby
        </Link>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="game-shell">
        <p className="inline-error">This game could not be loaded.</p>
        <Link className="text-button" href="/">
          Back to lobby
        </Link>
      </main>
    );
  }

  if (game.status !== "active") {
    const won = game.winner === game.side;
    const ratingDelta =
      game.ratingBefore !== null &&
      game.ratingBefore !== undefined &&
      game.ratingAfter !== null &&
      game.ratingAfter !== undefined
        ? Math.round(game.ratingAfter - game.ratingBefore)
        : null;
    return (
      <main className="game-shell">
        <header className="topbar">
          <Link href="/" className="wordmark">
            <span className="wordmark-mark">M</span> MATH / RANKER
          </Link>
          <span className="eyebrow">ROUND COMPLETE</span>
        </header>
        <section className="result-panel">
          {game.ratingAfter !== null && game.ratingAfter !== undefined && (
            <ResultLeaderboard
              key={game.id}
              category={game.category}
              preset={game.preset}
              username={player?.username ?? "You"}
              avatarId={avatar.id}
              ratingBefore={game.ratingBefore ?? game.ratingAfter}
              ratingAfter={game.ratingAfter}
            />
          )}
          <p className="eyebrow">FINAL SCORE</p>
          <strong className="final-score">{score}</strong>
          <h1>
            {game.winner === "draw"
              ? "Dead even."
              : won
                ? "Well played."
                : "Good duel."}
          </h1>
          <p>
            {game.winner === "draw"
              ? "A draw on both accuracy and time."
              : won
                ? "You took this round."
                : "Your next round is a fresh start."}
          </p>
          {game &&
            ratingDelta !== null &&
            game.ratingBefore !== null &&
            game.ratingAfter !== null && (
              <section
                className={`rating-reward ${ratingDelta >= 0 ? "rating-up" : "rating-down"}`}
                aria-label="Rating change"
              >
                <span className="reward-spark" aria-hidden="true">
                  ✦
                </span>
                <p className="eyebrow">
                  {timeControls[game.preset].label.toUpperCase()} RATING
                </p>
                <strong className="reward-rating">
                  {Math.round(game.ratingAfter)}
                </strong>
                <div className="rating-change-line">
                  <span>{Math.round(game.ratingBefore)}</span>
                  <span aria-hidden="true">→</span>
                  <b>{Math.round(game.ratingAfter)}</b>
                  <strong className="rating-delta-value">
                    {ratingDelta > 0 ? "+" : ""}
                    {ratingDelta}
                  </strong>
                </div>
                <p className="reward-caption">
                  {ratingDelta > 0
                    ? "Rating increased"
                    : ratingDelta < 0
                      ? "Rating decreased"
                      : "Rating held steady"}
                </p>
              </section>
            )}
          <Link className="primary-action" href="/">
            Return to lobby <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>
    );
  }

  const question = snapshot.question;
  const progress = game.questionCount
    ? (game.currentPosition / game.questionCount) * 100
    : 0;

  return (
    <main className="game-shell">
      <header className="topbar">
        <Link href="/" className="wordmark">
          <span className="wordmark-mark">M</span> MATH / RANKER
        </Link>
        <span className="game-category">
          {game.category} <i />
          {game.isBot
            ? `${game.opponentName ?? "BOT"} · ${game.opponentRating ?? "—"}`
            : game.side === "a"
              ? "PLAYER A"
              : "PLAYER B"}
        </span>
      </header>
      <section className="duel-toolbar">
        <div>
          <p className="eyebrow">LIVE DUEL</p>
          <strong>{score}</strong>
        </div>
        <div className="round-count">
          QUESTION{" "}
          <b>
            {Math.min(game.currentPosition + 1, game.questionCount)
              .toString()
              .padStart(2, "0")}
          </b>
          <span> / {game.questionCount.toString().padStart(2, "0")}</span>
        </div>
      </section>
      <div className="progress-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <section className="question-stage">
        <div className="timer-row">
          <span className="eyebrow">TIME REMAINING</span>
          <strong className={remaining <= 3 ? "timer urgent" : "timer"}>
            {remaining.toString().padStart(2, "0")}
            <small>s</small>
          </strong>
        </div>
        <div className="question-content">
          <p className="question-kicker">
            {game.category.toUpperCase()} / QUESTION {game.currentPosition + 1}
          </p>
          {question?.imageUrl && (
            <Image
              className="question-image"
              src={question.imageUrl}
              alt="Question diagram"
              width={1200}
              height={800}
              unoptimized
            />
          )}
          <h1>{question?.body ?? "Preparing question…"}</h1>
          {alreadyAnswered ? (
            <div className="answer-wait">
              <span className="submitted-check">✓</span>
              <div>
                <strong>Answer locked</strong>
                <p>Waiting for your opponent…</p>
              </div>
            </div>
          ) : (
            <form className="answer-form" onSubmit={submit}>
              {question?.type === "multiple_choice" && question.choices ? (
                <div className="choice-grid">
                  {question.choices.map((choice, index) => (
                    <button
                      type="button"
                      key={choice.id}
                      className={`choice-button ${answer === choice.id ? "is-selected" : ""}`}
                      aria-pressed={answer === choice.id}
                      onClick={() =>
                        setDraft({
                          position: game.currentPosition,
                          value: choice.id,
                        })
                      }
                    >
                      <span>{String.fromCharCode(65 + index)}</span>
                      {choice.text ?? choice.id}
                    </button>
                  ))}
                </div>
              ) : (
                <label className="answer-input-label">
                  Your answer
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={answer}
                    onChange={(event) =>
                      setDraft({
                        position: game.currentPosition,
                        value: event.target.value,
                      })
                    }
                    placeholder="Type a number or fraction"
                    maxLength={50}
                  />
                </label>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary-action submit-answer"
                disabled={busy || !answer.trim()}
              >
                {busy
                  ? "Submitting…"
                  : remaining === 0
                    ? "Lock timeout"
                    : "Submit answer"}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
          )}
          {snapshot.answerStatus?.[game.side === "a" ? "b" : "a"] &&
            !alreadyAnswered && (
              <p className="opponent-status">
                Opponent answered. Your clock is still running.
              </p>
            )}
        </div>
      </section>
      <footer className="game-footer">
        <span>SERVER-TIMED ROUND</span>
        <span>YOUR ANSWER IS PRIVATE UNTIL LOCKED</span>
      </footer>
    </main>
  );
}
