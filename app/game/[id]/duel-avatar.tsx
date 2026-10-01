"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";

const frames = [
  { name: "A", delay: 0, duration: 120 },
  { name: "B", delay: 120, duration: 120 },
  { name: "C", delay: 240, duration: 2400 },
  { name: "D", delay: 2640, duration: 120 },
  { name: "E", delay: 2760, duration: 240 },
];

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
            key={frame.name}
            className={`duel-sprite-frame duel-sprite-frame-${index}`}
            src={opponent ? `/sprites/defReversed/rev${frame.name}.png` : `/sprites/defavatar/defavatar${frame.name}.png`}
            alt=""
            fill
            sizes="(max-width: 600px) 140px, 190px"
            unoptimized
            loading="eager"
            style={{
              "--frame-delay": `${frame.delay}ms`,
              "--frame-duration": `${frame.duration}ms`,
            } as CSSProperties}
          />
        ))}
        {celebrating && <span className="duel-correct-burst">Correct! +1</span>}
      </div>
      {celebrating && (
        <div key={`light-${correctAnswers}`} className="duel-magic-light" aria-hidden="true">
          {[0, 1, 2].map((segment) => (
            <div className="duel-magic-segment" key={segment}>
              <Image src="/sprites/light.jpg" alt="" fill sizes="33vw" unoptimized loading="eager" />
            </div>
          ))}
        </div>
      )}
      <span className="duel-fighter-score" aria-live="polite">
        <b>{correctAnswers}</b> correct
      </span>
    </div>
  );
}
