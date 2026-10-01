"use client";

import { useEffect, useRef, useState } from "react";
import { buildRankingBoard } from "../../../src/lib/game/ranking-board";
import { timeControls, type TimeControl } from "../../../src/lib/game/time-controls";
import { PlayerAvatar } from "../../components/player-profile";

const MOVE_DURATION_MS = 1200;
const REVEAL_DELAY_MS = 550;

export default function ResultLeaderboard({
  category,
  preset,
  username,
  avatarId,
  ratingBefore,
  ratingAfter,
}: {
  category: string;
  preset: TimeControl;
  username: string;
  avatarId: string;
  ratingBefore: number;
  ratingAfter: number;
}) {
  const rows = buildRankingBoard({
    category,
    preset,
    username,
    ratingBefore,
    ratingAfter,
  });
  const player = rows.find((row) => row.isPlayer)!;
  const rankChange = player.beforeRank - player.afterRank;
  const [phase, setPhase] = useState<"before" | "moving" | "done">(
    rankChange === 0 ? "done" : "before",
  );
  const boardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (rankChange === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No distance to travel, or the visitor prefers less motion.
      const frame = window.requestAnimationFrame(() => setPhase("done"));
      return () => window.cancelAnimationFrame(frame);
    }

    let revealTimer: number;
    let finishTimer: number;
    const frame = window.requestAnimationFrame(() => {
      boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      revealTimer = window.setTimeout(() => {
        setPhase("moving");
        finishTimer = window.setTimeout(() => setPhase("done"), MOVE_DURATION_MS);
      }, REVEAL_DELAY_MS);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(revealTimer);
      window.clearTimeout(finishTimer);
    };
  }, [rankChange]);

  return (
    <section
      ref={boardRef}
      className="result-leaderboard"
      aria-labelledby="ranking-heading"
    >
      <div className="result-ranking-heading">
        <div>
          <p className="eyebrow">DIVISION STANDINGS</p>
          <h2 id="ranking-heading">{timeControls[preset].label} board</h2>
        </div>
        <span>{category.toUpperCase()}</span>
      </div>
      <p className="ranking-status" role="status">
        {phase === "done"
          ? `Final standing: ${username} is rank ${player.afterRank}.`
          : `Updating standings: ${username} moves from rank ${player.beforeRank} to ${player.afterRank}.`}
      </p>
      <ol className={phase === "moving" ? "is-moving" : ""} aria-hidden={phase !== "done"}>
        {rows.map((entry) => (
          <li
            key={entry.isPlayer ? "current-player" : entry.username}
            className={entry.isPlayer ? "is-player" : ""}
            style={
              phase === "before"
                ? {
                    transform: `translateY(${(entry.beforeRank - entry.afterRank) * 62}px)`,
                  }
                : undefined
            }
          >
            <span className="ranking-position">
              {phase === "done" ? entry.afterRank : entry.beforeRank}
            </span>
            {entry.isPlayer ? (
              <PlayerAvatar username={entry.username} skinId={avatarId} size={42} />
            ) : (
              <span className="ranking-mark" aria-hidden="true">
                {entry.username.charAt(0).toUpperCase()}
              </span>
            )}
            <strong>
              {entry.username}
              {entry.isPlayer && <small>YOU</small>}
            </strong>
            {entry.isPlayer && (
              <span className={`ranking-movement ${rankChange > 0 ? "up" : rankChange < 0 ? "down" : ""}`}>
                {rankChange > 0
                  ? `↑ ${rankChange}`
                  : rankChange < 0
                    ? `↓ ${Math.abs(rankChange)}`
                    : "—"}
              </span>
            )}
            <b>
              {entry.isPlayer && phase === "before"
                ? Math.round(ratingBefore)
                : Math.round(entry.rating)}
            </b>
          </li>
        ))}
      </ol>
      <p className="sample-data-note">
        Opponent names and ratings are illustrative.
      </p>
    </section>
  );
}
