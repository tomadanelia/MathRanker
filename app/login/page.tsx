"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "../../src/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();

    try {
      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim().toLowerCase() },
          },
        });
        if (signupError) throw signupError;
        if (!data.session) {
          setMessage(
            "No session was created. Check that email confirmation is disabled in Supabase Auth settings.",
          );
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        const { error: signinError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signinError) throw signinError;
        router.push("/");
        router.refresh();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-topbar">
        <Link href="/" className="wordmark">
          <span className="wordmark-mark">M</span> MATH / RANKER
        </Link>
        <span className="auth-edition">PLAYER ACCESS / 01</span>
      </div>
      <section className="auth-layout">
        <div className="auth-aside">
          <p className="eyebrow">YOUR JOURNEY STARTS HERE</p>
          <h1>
            A little knowledge,
            <br />
            <em>a little magic.</em>
          </h1>
          <p>Enter the arena, master your craft, and build your rating through math duels.</p>
          <div className="auth-equation" aria-hidden="true">
            x² + 2x + 1<br />
            <span>= (x + 1)²</span>
          </div>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {isSignup ? "NEW PLAYER" : "WELCOME BACK"}
              </p>
              <h2>{isSignup ? "Create account" : "Sign in"}</h2>
            </div>
          </div>
          {isSignup && (
            <label>
              Username
              <input
                autoComplete="username"
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_]+"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="your_handle"
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8 characters minimum"
            />
          </label>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="inline-success" role="status">
              {message}
            </p>
          )}
          <button className="primary-action" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="auth-switch">
            {isSignup ? "Already registered?" : "New to Math Ranker?"}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError(null);
                setMessage(null);
              }}
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
