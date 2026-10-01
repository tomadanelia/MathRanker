"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createSupabaseBrowserClient } from "../../src/lib/supabase/client";
import { avatarSkins, resolveAvatarSkin } from "../../src/lib/avatar-skins";

export function usePlayer() {
  const [player, setPlayer] = useState<{
    id: string;
    username: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const client = createSupabaseBrowserClient();
    async function load(
      user: { id: string; user_metadata: Record<string, unknown> } | null,
    ) {
      const current = ++revision;
      if (!active) return;
      if (!user) {
        setPlayer(null);
        return;
      }
      setPlayer({
        id: user.id,
        username:
          typeof user.user_metadata.username === "string"
            ? user.user_metadata.username
            : "Player",
      });
      const { data } = await client
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (active && current === revision && data)
        setPlayer({ id: user.id, username: data.username });
    }
    void client.auth.getUser().then(({ data }) => load(data.user));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      // Defer profile queries until the auth callback releases its lock.
      void Promise.resolve().then(() => load(session?.user ?? null));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  return player;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("avatar-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("avatar-change", callback);
  };
}

export function useAvatar(userId: string | undefined) {
  const key = userId ? `math-ranker:avatar:${userId}` : null;
  const id = useSyncExternalStore(subscribe, () => {
    try { return key ? localStorage.getItem(key) : null; } catch { return null; }
  }, () => null);
  return resolveAvatarSkin(id);
}

export function PlayerAvatar({
  username,
  skinId,
  size = 40,
}: {
  username: string;
  skinId: string;
  size?: number;
}) {
  const skin = resolveAvatarSkin(skinId);
  return skin.image ? (
    <Image
      className="player-avatar"
      src={skin.image}
      alt={`${skin.name} avatar`}
      width={size}
      height={size}
    />
  ) : (
    <span
      className="player-avatar avatar-initial"
      style={{ width: size, height: size }}
      aria-label={`${username}'s avatar`}
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}

export default function PlayerProfile() {
  const player = usePlayer();
  const skin = useAvatar(player?.id);
  const [message, setMessage] = useState("");
  if (!player) return null;
  function select(id: string) {
    try {
      localStorage.setItem(`math-ranker:avatar:${player!.id}`, id);
      window.dispatchEvent(new Event("avatar-change"));
      setMessage("Avatar saved.");
    } catch {
      setMessage(
        "Your browser could not save the avatar. Allow local storage and try again.",
      );
    }
  }
  return (
    <section className="profile-panel" id="profile" aria-labelledby="profile-heading">
      <div className="profile-identity">
        <PlayerAvatar username={player.username} skinId={skin.id} size={64} />
        <div>
          <p className="eyebrow">YOUR PROFILE</p>
          <h2 id="profile-heading">{player.username}</h2>
          <span className="muted">{skin.name}</span>
        </div>
      </div>
      <fieldset className="avatar-picker">
        <legend>Choose your avatar</legend>
        <div className="avatar-options">
          {avatarSkins.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={skin.id === option.id}
              onClick={() => select(option.id)}
            >
              <PlayerAvatar
                username={player.username}
                skinId={option.id}
                size={48}
              />
              <span>{option.name}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <p className="profile-note">Saved for this account in this browser. More characters coming soon.</p>
      <p className="profile-note" role="status">{message}</p>
    </section>
  );
}
