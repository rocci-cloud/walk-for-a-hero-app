import { createContext, useContext, type ReactNode } from "react";
import { useAuth, type Walker } from "./AuthContext";
import { useWalkerExtras, type Backer, type Hero } from "../lib/data";

type Ctx = {
  walker: Walker | null;
  hero: Hero | null;
  backers: Backer[];
  loaded: boolean;
  /** Re-read the walker record, hero and backers. */
  reloadAll: () => Promise<void>;
};

const WalkerDataCtx = createContext<Ctx | null>(null);

/** One copy of the walker's hero and backers, shared by every tab. */
export function WalkerDataProvider({ children }: { children: ReactNode }) {
  const { state, refresh } = useAuth();
  const walker = state.status === "signed_in" ? state.walker : null;
  const { hero, backers, loaded, reload } = useWalkerExtras(walker);
  const reloadAll = async () => {
    await refresh().catch(() => {});
    await reload().catch(() => {});
  };
  return <WalkerDataCtx.Provider value={{ walker, hero, backers, loaded, reloadAll }}>{children}</WalkerDataCtx.Provider>;
}

export function useWalkerData() {
  const ctx = useContext(WalkerDataCtx);
  if (!ctx) throw new Error("useWalkerData outside WalkerDataProvider");
  return ctx;
}
