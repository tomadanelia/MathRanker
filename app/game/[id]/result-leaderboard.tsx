"use client";

import { useEffect, useRef, useState } from "react";
import { buildRankingBoard } from "../../../src/lib/game/ranking-board";
import { timeControls, type TimeControl } from "../../../src/lib/game/time-controls";
import { playRankingSound, prepareRankingSound } from "../../../src/lib/game/ranking-sound";
import { PlayerAvatar } from "../../components/player-profile";

const MOVE_DURATION_MS = 7000;
const REVEAL_DELAY_MS = 1400;

export default function ResultLeaderboard({
  category,
  preset,
  username,
  avatarId,
  ratingBefore,
  ratingAfter,
  outcome,
}: {
  category: string;
  preset: TimeControl;
  username: string;
  avatarId: string;
  ratingBefore: number;
  ratingAfter: number;
  outcome: "win" | "loss" | "draw";
}) {
  const rows = buildRankingBoard({
    preset,
    username,
    ratingBefore,
    ratingAfter,
    outcome,
  });
  const player = rows.find((row) => row.isPlayer)!;
  const rankChange = player.beforeRank - player.afterRank;
  const firstRank = rows[0].afterRank;
  const [progress, setProgress] = useState(rankChange === 0 ? 1 : -1);
  const [replay, setReplay] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const stopSound = useRef<() => void>(() => {});
  const boardRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const phase = progress < 0 ? "before" : progress < 1 ? "moving" : "done";

  useEffect(() => {
    const board = boardRef.current;
    const viewport = viewportRef.current;
    if (!board || !viewport) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    board.scrollIntoView({ behavior: "instant", block: "start" });
    let visible = false;
    let elapsed = 0;
    let lastTime: number | undefined;
    let sounding = false;
    let frame: number;
    const pauseSound = () => {
      stopSound.current();
      sounding = false;
      lastTime = undefined;
    };
    const onVisibilityChange = () => {
      if (document.hidden) pauseSound();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      if (!visible) pauseSound();
    }, { threshold: [0, 0.5] });
    observer.observe(viewport);

    const animate = (now: number) => {
      const skip = rankChange === 0 || reducedMotion.matches;
      const running = visible && !document.hidden;
      if (running && lastTime !== undefined) elapsed += Math.min(now - lastTime, 100);
      lastTime = running ? now : undefined;
      const fraction = skip ? 1 : Math.max(0, Math.min(1, (elapsed - REVEAL_DELAY_MS) / MOVE_DURATION_MS));
      // Smooth, deliberate travel; the same progress keeps the row in view on phones.
      const eased = fraction * fraction * (3 - 2 * fraction);
      setProgress(skip || elapsed >= REVEAL_DELAY_MS ? eased : -1);
      const rank = player.beforeRank + (player.afterRank - player.beforeRank) * eased;
      // Display ranks are in the thousands; scrolling uses local row positions.
      // Begin near the bottom, then let the row rise through the visible window.
      const anchor = rankChange > 0 ? 0.82 - 0.52 * eased : 0.82;
      viewport.scrollTop = (rank - firstRank + 0.5) * 62 - viewport.clientHeight * anchor;
      if (running && !skip && elapsed >= REVEAL_DELAY_MS && !sounding && !mutedRef.current) {
        stopSound.current = playRankingSound(rankChange > 0, (1 - fraction) * MOVE_DURATION_MS);
        sounding = true;
      }
      if ((!running || mutedRef.current) && sounding) {
        stopSound.current();
        sounding = false;
      }
      if (fraction < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopSound.current();
    };
  }, [rankChange, player.beforeRank, player.afterRank, firstRank, replay]);

  return (
    <section
      ref={boardRef}
      className={`result-leaderboard is-${phase} ${rankChange > 0 ? "rank-gain" : ""}`}
      aria-labelledby="ranking-heading"
    >
      <div className="result-ranking-heading">
        <div>
          <p className="eyebrow">DEMO DIVISION STANDINGS</p>
          <h2 id="ranking-heading">{timeControls[preset].label} board</h2>
        </div>
        <span>{category.toUpperCase()}</span>
      </div>
      <div className="ranking-controls">
        <span>{phase === "before" ? "Your standing before the round" : phase === "moving" ? "Updating your rank..." : "Final standings"}</span>
        <button type="button" aria-pressed={!muted} onClick={() => {
          prepareRankingSound();
          mutedRef.current = !muted;
          setMuted(!muted);
          if (!muted) stopSound.current();
        }}>Sound {muted ? "off" : "on"}</button>
        {rankChange !== 0 && <button type="button" onClick={() => {
          prepareRankingSound();
          setProgress(-1);
          setReplay((value) => value + 1);
        }}>Replay</button>}
      </div>
      <p className="ranking-status" role="status">
        {phase === "done"
          ? `Final standing: ${username} is rank ${player.afterRank}.`
          : `Updating standings: ${username} moves from rank ${player.beforeRank} to ${player.afterRank}.`}
      </p>
      <div className="ranking-viewport" ref={viewportRef}>
      <ol aria-hidden={phase !== "done"}>
        {rows.map((entry) => (
          <li
            key={entry.isPlayer ? "current-player" : `opponent-${entry.beforeRank}`}
            className={entry.isPlayer ? "is-player" : ""}
            style={{
              transform: `translateY(${(entry.beforeRank - entry.afterRank) * 62 * (1 - Math.max(0, progress))}px)`,
            }}
          >
            <span className="ranking-position">
              #{Math.round(entry.beforeRank + (entry.afterRank - entry.beforeRank) * Math.max(0, progress))}
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
      </div>
      <p className="sample-data-note">
        Demo ranks and opponents are simulated. Your rating is real.
      </p>
    </section>
  );
}
