import { useCallback, useEffect, useState } from "react";
import { base44 } from "./base44";
import { MISSION_MILES, SITE_URL, WALK_WINDOW_DAYS } from "./config";
import type { Walker } from "../auth/AuthContext";

/**
 * Everything the screens read besides the Walker record, and the website's
 * math for it. The formulas here are copied from the website's
 * src/lib/portal.js (and, through it, mark-backer-collected) so the app and
 * walkforahero.com always show the same numbers.
 */

export type Hero = {
  id: string;
  name: string;
  slug: string;
  photo_url?: string;
  conflict?: string;
  branch?: string;
  rank?: string;
  bio?: string;
  story?: string;
  goal_amount?: number;
  raised_amount?: number;
  is_anchor?: boolean;
  status?: string;
};

export type Backer = {
  id: string;
  backer_name: string;
  backer_email?: string;
  pledge_per_mile: number;
  max_pledge?: number;
  collected?: boolean;
  collected_amount?: number;
  created_date?: string;
};

/* ── Walk window (portal.js walkWindowStatus) ───────────────────────── */

export function walkWindow(createdIso?: string) {
  const started = Date.parse(createdIso || "");
  if (!started) return { day: 1, daysLeft: WALK_WINDOW_DAYS, closed: false, endsOn: null as Date | null };
  const elapsed = Math.floor((Date.now() - started) / 86400000);
  const daysLeft = Math.max(0, WALK_WINDOW_DAYS - elapsed);
  return {
    day: Math.min(WALK_WINDOW_DAYS, elapsed + 1),
    daysLeft,
    closed: daysLeft <= 0,
    endsOn: new Date(started + WALK_WINDOW_DAYS * 86400000),
  };
}

/* ── Pledges (portal.js backerCurrentCharge) ────────────────────────── */

export const MAX_PLEDGE_PER_MILE = 100;
export const MAX_COLLECTED_PER_BACKER = 2000;

export function backerCurrentCharge(b: Pick<Backer, "pledge_per_mile" | "max_pledge">, walkerMiles: number) {
  const perMile = Math.min(Number(b?.pledge_per_mile) || 0, MAX_PLEDGE_PER_MILE);
  const maxPledge = Number(b?.max_pledge) || 0;
  const optedInMiles = perMile > 0 ? Math.max(MISSION_MILES, maxPledge / perMile) : MISSION_MILES;
  const billable = Math.min(Math.max(0, Number(walkerMiles) || 0), optedInMiles);
  const raw = perMile * billable;
  const capped = maxPledge > 0 ? Math.min(raw, maxPledge) : raw;
  return Math.min(capped, MAX_COLLECTED_PER_BACKER);
}

export function pledgeSummary(backers: Backer[], miles: number) {
  const open = backers.filter((b) => !b.collected);
  return {
    count: backers.length,
    perMile: open.reduce((s, b) => s + Math.min(Number(b.pledge_per_mile) || 0, MAX_PLEDGE_PER_MILE), 0),
    /** Projected, not yet collected — the website labels it the same way. */
    pledgedToCollect: open.reduce((s, b) => s + backerCurrentCharge(b, miles), 0),
    /** If the walker finishes all 15 miles. */
    pledgedAtFinish: open.reduce((s, b) => s + backerCurrentCharge(b, MISSION_MILES), 0),
    collected: backers.reduce((s, b) => s + (b.collected ? Number(b.collected_amount) || 0 : 0), 0),
  };
}

export const PROJECTION_NOTE = "Dollar figures here are projections from pledged per-mile amounts, not funds collected.";

/* ── Links (same URLs the website uses) ─────────────────────────────── */

export const links = {
  walkerPage: (w: Walker) => `${SITE_URL}/walk/${w.slug}`,
  backWalker: (w: Walker) => `${SITE_URL}/donate?walker=${encodeURIComponent(w.slug)}`,
  giveToHero: (h: Hero) => `${SITE_URL}/donate?hero=${encodeURIComponent(h.slug)}`,
  heroPage: (h: Hero) => `${SITE_URL}/heroes/${h.slug}`,
  backerPortal: (b: Backer) => `${SITE_URL}/portal/backer/${b.id}`,
};

/** portal.js inviteMessageTemplates, word for word. */
export function inviteTemplates(walkerName: string, heroName: string, link: string) {
  const heroLine = heroName ? ` for ${heroName}` : "";
  return [
    {
      id: "direct",
      label: "Direct ask",
      text: `I need your help. I'm walking for Walk For A Hero${heroLine} — every mile I walk funds real medical technology that lets a veteran stand and walk again. Can you pledge $1–$5 per mile? Takes 30 seconds: ${link}`,
    },
    {
      id: "casual",
      label: "Casual",
      text: `Hey! I'm walking 15 miles${heroLine} to help fund a life-changing exoskeleton for a paralyzed veteran. Would you back me a few bucks per mile? ${link}`,
    },
    {
      id: "milestone",
      label: "Milestone",
      text: `Update: ${walkerName || "I"} just hit a new milestone on my Walk For A Hero walk${heroLine}! Help me push further — back my walk here: ${link}`,
    },
  ];
}

/* ── Formatting ─────────────────────────────────────────────────────── */

export const money = (n?: number, cents = true) =>
  `$${(Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;

export const initials = (name?: string) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "W";

export function heroSubtitle(h?: Hero | null) {
  if (!h) return "";
  const war = h.conflict ? h.conflict.replace(/\s*\(.*\)\s*$/, "") : "";
  return [war && `${war} veteran`, h.branch].filter(Boolean).join(" · ");
}

/* ── Loading ────────────────────────────────────────────────────────── */

const HEX_ID = /^[a-f0-9]{24}$/;

export async function listHeroes(): Promise<Hero[]> {
  const list: Hero[] = await base44.entities.Hero.filter({ hidden: false }, "-is_anchor", 50);
  return (list || []).filter((h) => h.status !== "funded" || h.is_anchor);
}

/**
 * The walker's hero. hero_supported_id is a Hero id on current records and a
 * free-text name on old ones (the website's heroLink.js does the same).
 */
export async function resolveHero(w: Walker | null): Promise<Hero | null> {
  const ref = w?.hero_supported_id || "";
  if (ref && HEX_ID.test(ref)) {
    const h = await base44.entities.Hero.get(ref).catch(() => null);
    if (h) return h as Hero;
  }
  const name = (w?.hero_supported_name || (!HEX_ID.test(ref) ? ref : "")).trim().toLowerCase();
  if (!name) return null;
  const all = await listHeroes().catch(() => [] as Hero[]);
  return all.find((h) => h.name.toLowerCase() === name) || all.find((h) => name.includes(h.name.toLowerCase().split(" ").pop() || "~")) || null;
}

export async function listBackers(w: Walker): Promise<Backer[]> {
  const list: Backer[] = await base44.entities.Backer.filter({ walker_id: w.id }, "-created_date", 200);
  return list || [];
}

/** Hero + backers for the signed-in walker, refreshed on demand. */
export function useWalkerExtras(walker: Walker | null) {
  const [hero, setHero] = useState<Hero | null>(null);
  const [backers, setBackers] = useState<Backer[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchBoth = useCallback(
    () => (walker ? Promise.all([resolveHero(walker).catch(() => null), listBackers(walker).catch(() => null)]) : Promise.resolve(null)),
    [walker],
  );

  const apply = (r: [Hero | null, Backer[] | null] | null) => {
    if (!r) return;
    setHero(r[0]);
    if (r[1]) setBackers(r[1]);
    setLoaded(true);
  };

  const reload = useCallback(async () => apply(await fetchBoth()), [fetchBoth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchBoth();
      if (!cancelled) apply(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchBoth]);

  return { hero, backers, loaded, reload };
}
