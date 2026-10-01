"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../src/lib/api/client";
import { timeControls, type TimeControl } from "../src/lib/game/time-controls";
import { createSupabaseBrowserClient } from "../src/lib/supabase/client";

const categories = [
  { slug: "arithmetic", name: "Arithmetic", mark: "01" },
  { slug: "algebra", name: "Algebra", mark: "02" },
  { slug: "geometry", name: "Geometry", mark: "03" },
  { slug: "mixed", name: "Mixed", mark: "04" },
];

const timeControlEntries = Object.entries(timeControls) as [
  TimeControl,
  (typeof timeControls)[TimeControl],
][];

const sampleLeaderboards: Record<
  TimeControl,
  Array<{ username: string; rating: number }>
> = {
  blitz: [
    { username: "numberfox", rating: 2386 },
    { username: "sum_sprinter", rating: 2261 },
    { username: "primepulse", rating: 2184 },
  ],
  standard: [
    { username: "proofpoint", rating: 2452 },
    { username: "algebrakit", rating: 2310 },
    { username: "squaredaway", rating: 2206 },
  ],
  rapid: [
    { username: "quiet_theorem", rating: 2524 },
    { username: "vectorviolet", rating: 2392 },
    { username: "logic_lark", rating: 2278 },
  ],
};

const categoryRatingOffsets: Record<string, number> = {
  arithmetic: 0,
  algebra: 34,
  geometry: -21,
  mixed: 12,
};

type MatchResponse =
  | { status: "matched"; gameId: string }
  | { status: "waiting" };
type MatchStatus = MatchResponse | { status: "not_queued" };

export default function HomeScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [category, setCategory] = useState("arithmetic");
  const [preset, setPreset] = useState<TimeControl>("blitz");
  const [personalRatings, setPersonalRatings] = useState<
    Partial<Record<TimeControl, number>>
  >({});
  const [loadedRatingKey, setLoadedRatingKey] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUserEmail(data.user?.email ?? null);
        setAuthLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserEmail(session?.user.email ?? null);
        setAuthLoading(false);
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail) return;

    let active = true;
    const ratingKey = `${userEmail}:${category}`;
    void api
      .get<{
        ratings: Array<{ preset: TimeControl; rating: number }>;
      }>(`/ratings?category=${encodeURIComponent(category)}`)
      .then(({ ratings }) => {
        if (active) {
          setPersonalRatings(
            Object.fromEntries(
              ratings.map((rating) => [rating.preset, rating.rating]),
            ),
          );
          setLoadedRatingKey(ratingKey);
        }
      })
      .catch(() => {
        if (active) {
          setPersonalRatings({});
          setLoadedRatingKey(ratingKey);
        }
      });

    return () => {
      active = false;
    };
  }, [category, userEmail]);

  useEffect(() => {
    if (!waiting) return;
    const checkMatch = async () => {
      try {
        const result = await api.get<MatchStatus>("/matchmaking");
        if (result.status === "matched") router.push(`/game/${result.gameId}`);
        if (result.status === "not_queued") setWaiting(false);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not check matchmaking.",
        );
      }
    };
    const interval = window.setInterval(() => void checkMatch(), 1800);
    return () => window.clearInterval(interval);
  }, [router, waiting]);

  async function findMatch() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<MatchResponse>("/matchmaking", {
        category,
        preset,
      });
      if (result.status === "matched") router.push(`/game/${result.gameId}`);
      else setWaiting(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start matchmaking.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelMatch() {
    setBusy(true);
    try {
      await api.del<{ status: string }>("/matchmaking");
      setWaiting(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not cancel matchmaking.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    setWaiting(false);
  }

  return (
    <main className="arena-shell">
      <header className="topbar">
        <Link href="/" className="wordmark">
          <span className="wordmark-mark">M</span> MATH / RANKER
        </Link>
        <div className="account-slot">
          {authLoading ? (
            <span className="muted">Checking session</span>
          ) : userEmail ? (
            <>
              <span className="account-email">{userEmail}</span>
              <button className="text-button" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <Link className="text-button" href="/login">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="home-layout">
        <div className="home-intro">
          <p className="eyebrow">
            <span className="live-dot" /> RANKED DUELS / SEASON 01
          </p>
          <h1>
            Think fast.
            <br />
            <em>Play sharp.</em>
          </h1>
          <p className="intro-copy">
            One question at a time. Same clock, same challenge. Your rating
            follows the work.
          </p>
          <div className="intro-stats">
            <div>
              <strong>05</strong>
              <span>questions / blitz</span>
            </div>
            <div>
              <strong>10</strong>
              <span>questions / standard</span>
            </div>
            <div>
              <strong>10</strong>
              <span>questions / rapid</span>
            </div>
          </div>
          <div className="grid-stamp" aria-hidden="true">
            <span>+</span>
            <span>×</span>
            <span>÷</span>
            <span>−</span>
          </div>
        </div>

        <section className="match-panel" aria-labelledby="match-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">FIND A MATCH</p>
              <h2 id="match-heading">Set your round</h2>
            </div>
            <span className="panel-index">01—02</span>
          </div>

          <fieldset className="category-picker" disabled={waiting || busy}>
            <legend>Choose a category</legend>
            <div className="category-list">
              {categories.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  className={`category-option ${category === item.slug ? "is-selected" : ""}`}
                  onClick={() => setCategory(item.slug)}
                  aria-pressed={category === item.slug}
                >
                  <span className="category-number">{item.mark}</span>
                  <span>{item.name}</span>
                  <span className="select-mark">
                    {category === item.slug ? "●" : "○"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="preset-picker" disabled={waiting || busy}>
            <legend>Match length</legend>
            <div className="segmented-control">
              {timeControlEntries.map(([timeControl, details]) => (
                <button
                  key={timeControl}
                  type="button"
                  aria-pressed={preset === timeControl}
                  className={preset === timeControl ? "is-selected" : ""}
                  onClick={() => setPreset(timeControl)}
                >
                  <span>{details.label}</span>
                  <small>{details.description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <section
            className="rating-preview"
            aria-label="Ratings by time control"
          >
            <div className="rating-preview-heading">
              <span>RATINGS / {category.toUpperCase()}</span>
              <span>{userEmail ? "YOUR ACCOUNT" : "SAMPLE PLAYERS"}</span>
            </div>
            <div className="rating-mode-grid">
              {timeControlEntries.map(([timeControl, details]) => (
                <article
                  key={timeControl}
                  className={`rating-mode-tile ${preset === timeControl ? "is-active" : ""}`}
                >
                  <div className="rating-mode-title">
                    <strong>{details.label}</strong>
                    {preset === timeControl && <span>PLAYING</span>}
                  </div>
                  <strong className="personal-rating-value">
                    {userEmail
                      ? loadedRatingKey !== `${userEmail}:${category}`
                        ? "..."
                        : personalRatings[timeControl] === undefined
                          ? "—"
                          : Math.round(personalRatings[timeControl])
                      : "1500"}
                  </strong>
                  <span className="personal-rating-caption">
                    {userEmail ? "your rating" : "starting rating"}
                  </span>
                  <ol className="sample-leaderboard">
                    {sampleLeaderboards[timeControl].map((player, index) => (
                      <li key={player.username}>
                        <span>{index + 1}</span>
                        <b>{player.username}</b>
                        <strong>
                          {player.rating +
                            (categoryRatingOffsets[category] ?? 0)}
                        </strong>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
            <p className="sample-data-note">
              Sample leaderboard names and ratings are illustrative, not live
              players.
            </p>
          </section>

          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {!userEmail && !authLoading ? (
            <Link className="primary-action" href="/login">
              Sign in to play <span aria-hidden="true">↗</span>
            </Link>
          ) : waiting ? (
            <div className="waiting-state">
              <div className="search-orbit" aria-hidden="true" />
              <div>
                <strong>Finding your opponent</strong>
                <span>
                  Searching{" "}
                  {categories
                    .find((item) => item.slug === category)
                    ?.name.toLowerCase()}{" "}
                  players · bot backup in 3 sec
                </span>
              </div>
              <button
                className="cancel-action"
                disabled={busy}
                onClick={cancelMatch}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="primary-action"
              disabled={busy || authLoading}
              onClick={findMatch}
            >
              {busy ? "Joining queue…" : "Find opponent"}
              <span aria-hidden="true">↗</span>
            </button>
          )}
          <p className="panel-footnote">
            Fair play is server-timed. Answers lock when the clock runs out.
          </p>
        </section>
      </section>
      <footer className="site-footer">
        <span>CALCULATE YOUR NEXT MOVE</span>
        <span>MATHEMATICS / COMPETITION / COMMUNITY</span>
      </footer>
    </main>
  );
}
