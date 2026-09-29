"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../src/lib/api/client";
import { createSupabaseBrowserClient } from "../src/lib/supabase/client";

const categories = [
  { slug: "arithmetic", name: "Arithmetic", mark: "01" },
  { slug: "algebra", name: "Algebra", mark: "02" },
  { slug: "geometry", name: "Geometry", mark: "03" },
  { slug: "mixed", name: "Mixed", mark: "04" },
];

type MatchResponse =
  | { status: "matched"; gameId: string }
  | { status: "waiting" };
type MatchStatus = MatchResponse | { status: "not_queued" };

export default function HomeScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [category, setCategory] = useState("arithmetic");
  const [preset, setPreset] = useState<"blitz" | "standard">("blitz");
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
              <button
                type="button"
                aria-pressed={preset === "blitz"}
                className={preset === "blitz" ? "is-selected" : ""}
                onClick={() => setPreset("blitz")}
              >
                <span>Blitz</span>
                <small>5 × 10 sec</small>
              </button>
              <button
                type="button"
                aria-pressed={preset === "standard"}
                className={preset === "standard" ? "is-selected" : ""}
                onClick={() => setPreset("standard")}
              >
                <span>Standard</span>
                <small>10 × 20 sec</small>
              </button>
            </div>
          </fieldset>

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
                  players · bot backup in 30 sec
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
