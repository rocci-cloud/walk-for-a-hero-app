import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { base44, httpStatus } from "../lib/base44";
import { clearSession, restoreSession } from "../lib/session";
import { wipeAll } from "../walk/store";
import { registerForPush, unregisterPush } from "../lib/push";

/**
 * Who is signed in, and their Walker record.
 *
 * The walker record is the SAME row the website shows on /dashboard and the
 * public walker page — miles_walked, total_raised, walk_history — so what the
 * app shows and what the website shows cannot drift apart.
 */

export type Walker = {
  id: string;
  name: string;
  email: string;
  slug: string;
  miles_walked?: number;
  goal_miles?: number;
  total_raised?: number;
  created_date?: string;
  hero_supported_id?: string;
  hero_supported_name?: string;
  photo_url?: string;
  walk_history?: { date: string; miles: number; flagged_for_review?: boolean }[];
  /** Walk again (2026-09-28): which walk this is, and the walks already finished. */
  walk_number?: number;
  current_walk_started_at?: string;
  completed_walks?: import("../lib/data").CompletedWalk[];
};

type User = { id: string; email: string; full_name?: string; role?: string };

type AuthState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; user: User; walker: Walker | null; walkerError?: string };

type Ctx = {
  state: AuthState;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Called after sign-in or sign-up succeeds. */
  signedIn: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

async function loadWalker(email: string): Promise<{ walker: Walker | null; error?: string }> {
  const list: Walker[] = await base44.entities.Walker.filter(
    { email: email.trim().toLowerCase(), active: true },
    "-created_date",
    5,
  );
  if (!list?.length) return { walker: null };
  if (list.length > 1) {
    // Same rule as log-walk-miles: more than one active record is a data
    // problem the Foundation must fix, not something to guess about.
    return {
      walker: null,
      error: "Your account has more than one walker profile. Please contact the Foundation so your miles go to the right place.",
    };
  }
  return { walker: list[0] };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const me: any = await base44.auth.me();
      if (!me?.email) throw Object.assign(new Error("no user"), { status: 401 });
      const { walker, error } = await loadWalker(me.email);
      setState({ status: "signed_in", user: me, walker, walkerError: error });
      // Refresh this phone's push token for anyone who already allowed notifications (never prompts).
      registerForPush(false).catch(() => {});
    } catch (err) {
      if (httpStatus(err) === 401 || httpStatus(err) === 403) {
        await clearSession();
        setState({ status: "signed_out" });
      } else {
        // Offline at launch: keep them signed in with what we know; screens
        // show their own "can't reach the server" states.
        setState((prev) =>
          prev.status === "signed_in" ? prev : { status: "signed_in", user: { id: "", email: "" }, walker: null, walkerError: "offline" },
        );
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (await restoreSession()) await load();
      else setState({ status: "signed_out" });
    })();
  }, [load]);

  const signOut = useCallback(async () => {
    await unregisterPush(); // while still signed in, so the server accepts it
    await clearSession();
    try {
      wipeAll();
    } catch {
      /* nothing stored */
    }
    setState({ status: "signed_out" });
  }, []);

  const value = useMemo<Ctx>(() => ({ state, refresh: load, signOut, signedIn: load }), [state, load, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
