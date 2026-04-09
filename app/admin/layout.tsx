"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, isAdmin, signIn, signOut } from "@/lib/auth";
import { getBrowserClient, hasPublicSupabaseEnv } from "@/lib/supabase";

function LoginForm({
  onLogin,
  disabled,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  disabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-eatlee-cream px-4 py-8">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-soft">
        <p className="text-sm uppercase tracking-[0.2em] text-eatlee-green/45">
          Admin access
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold text-eatlee-green">
          Eatlee Admin
        </h1>
        <p className="mt-3 text-sm leading-6 text-eatlee-green/60">
          Sign in with the Supabase admin account to update monthly prices and
          recalculate all PYF scores.
        </p>

        {error && (
          <div className="mt-5 rounded-2xl border border-eatlee-coral/20 bg-eatlee-coral/10 px-4 py-3 text-sm text-eatlee-coral">
            {error}
          </div>
        )}

        <form
          className="mt-6 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setLoading(true);

            try {
              await onLogin(email, password);
            } catch (loginError) {
              setError(
                loginError instanceof Error ? loginError.message : "Sign in failed."
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          <div>
            <label
              htmlFor="admin-email"
              className="mb-1 block text-sm font-medium text-eatlee-green"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={disabled || loading}
              className="w-full rounded-2xl border border-eatlee-mist px-4 py-3 text-eatlee-green outline-none transition focus:border-eatlee-green"
              placeholder="admin@eatlee.com"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-1 block text-sm font-medium text-eatlee-green"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={disabled || loading}
              className="w-full rounded-2xl border border-eatlee-mist px-4 py-3 text-eatlee-green outline-none transition focus:border-eatlee-green"
            />
          </div>

          <button
            type="submit"
            disabled={disabled || loading}
            className="w-full rounded-full bg-eatlee-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-eatlee-green/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const setupReady = useMemo(() => hasPublicSupabaseEnv(), []);

  useEffect(() => {
    if (!setupReady) {
      setLoading(false);
      return;
    }

    let active = true;
    const supabase = getBrowserClient();

    const loadSession = async () => {
      try {
        const { session: currentSession } = await getSession();

        if (active) {
          setSession(currentSession);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setupReady]);

  if (!setupReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-eatlee-cream px-4 py-8">
        <div className="max-w-lg rounded-[2rem] bg-white p-8 text-sm text-eatlee-green/70 shadow-soft">
          <h1 className="font-heading text-3xl font-bold text-eatlee-green">
            Supabase setup required
          </h1>
          <p className="mt-3 leading-7">
            Add the public Supabase environment variables before using the admin
            panel.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-eatlee-cream text-eatlee-green/60">
        Loading admin...
      </div>
    );
  }

  if (!isAdmin(session)) {
    return (
      <LoginForm
        disabled={!setupReady}
        onLogin={async (email, password) => {
          const result = await signIn(email, password);

          if (result.error) {
            throw new Error(result.error);
          }

          setSession(result.session);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-eatlee-cream">
      <header className="border-b border-eatlee-green/10 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-eatlee-green/40">
              Admin panel
            </p>
            <h1 className="font-heading text-2xl font-bold text-eatlee-green">
              Eatlee price management
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-eatlee-green/50 sm:inline">
              {session?.user.email}
            </span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setSession(null);
              }}
              className="rounded-full border border-eatlee-green/15 px-4 py-2 text-sm font-medium text-eatlee-green transition hover:bg-eatlee-mist"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
