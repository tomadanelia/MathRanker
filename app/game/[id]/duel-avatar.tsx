"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";

const frames = ["A", "B", "C", "D", "E"];

export default function DuelAvatar({
  name,
  opponent = false,
  correctAnswers,
}: {
  name: string;
  opponent?: boolean;
  correctAnswers: number;
}) {
  // Rejoining a duel should not celebrate answers made before mounting.
  const [initialCount] = useState(correctAnswers);
  const celebrating = correctAnswers > initialCount;

  return (
    <div className={`duel-fighter ${opponent ? "duel-fighter-opponent" : ""}`}>
      <div className="duel-fighter-label">
        <span>{opponent ? "OPPONENT" : "YOU"}</span>
        <strong title={name}>{name}</strong>
      </div>
      <div
        key={correctAnswers}
        className={`duel-sprite ${celebrating ? "is-casting" : ""}`}
        aria-hidden="true"
      >
        {frames.map((frame, index) => (
          <Image
            key={frame}
            className={`duel-sprite-frame duel-sprite-frame-${index}`}
            src={opponent ? `/sprites/defReversed/rev${frame}.png` : `/sprites/defavatar/defavatar${frame}.png`}
            alt=""
            fill
            sizes="(max-width: 600px) 140px, 190px"
            unoptimized
            loading="eager"
            style={{ "--frame-delay": `${index * 120}ms` } as CSSProperties}
          />
        ))}
        {celebrating && <span className="duel-correct-burst">Correct! +1</span>}
      </div>
      <span className="duel-fighter-score" aria-live="polite">
        <b>{correctAnswers}</b> correct
      </span>
    </div>
  );
}
