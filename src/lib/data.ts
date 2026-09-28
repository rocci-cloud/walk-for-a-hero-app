import { useCallback, useEffect, useState } from "react";
import { base44, callFunction, functionError } from "./base44";
import { DORMANT_AFTER_DAYS, MISSION_MILES, SITE_URL } from "./config";
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
  /** Walk again: which of the walker's walks this pledge backs. */
  walk_number?: number;
  /** Set once that walk is finished and the walker started another. */
  final_miles?: number | null;
};

/* ── Activity (portal.js walkerActivityStatus) ──────────────────────── */

/**
 * No walk deadline. A walker is dormant only after a full year with no walks
 * (counted from their last walk, or from signup if they have none); walking
 * again makes them active.
 */
export function walkerActivity(walker?: { created_date?: string; walk_history?: { date?: string; voided?: boolean }[] } | null, now = Date.now()) {
  let latest = Date.parse(walker?.created_date || "") || 0;
  for (const row of walker?.walk_history || []) {
    if (row?.voided) continue;
    const t = Date.parse(row?.date || "") || 0;
    if (t > latest) latest = t;
  }
  const daysSinceActive = latest ? Math.floor((now - latest) / 86400000) : 0;
  return { daysSinceActive, dormant: daysSinceActive >= DORMANT_AFTER_DAYS };
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

/* ── Walk again (website portal.js, 2026-09-28) ────────────────────── */

/** A pledge whose walk is finished: settled at that walk's final_miles. */
export function isSettled(b: Pick<Backer, "final_miles">) {
  return b?.final_miles !== undefined && b?.final_miles !== null && Number.isFinite(Number(b.final_miles));
}

/** The miles a pledge is charged against: its own walk's, not the new walk's. */
export function pledgeMiles(b: Pick<Backer, "final_miles">, walkerMiles: number) {
  return isSettled(b) ? Number(b.final_miles) : Number(walkerMiles) || 0;
}

/** Pledges that move with the CURRENT walk's miles. */
export function followingThisWalk(backers: Backer[]) {
  return backers.filter((b) => !b.collected && !isSettled(b));
}

export type CompletedWalk = {
  walk_number?: number;
  hero_id?: string;
  hero_name?: string;
  hero_slug?: string;
  miles?: number;
  goal_miles?: number;
  raised?: number;
  backers?: number;
  started_at?: string;
  completed_at?: string;
};

export const walkNumber = (w?: Walker | null) => Math.max(1, Number(w?.walk_number) || 1);
export const completedWalks = (w?: Walker | null): CompletedWalk[] => (Array.isArray(w?.completed_walks) ? w!.completed_walks!.filter(Boolean) : []);
export const lifetimeMiles = (w?: Walker | null) =>
  (Number(w?.miles_walked) || 0) + completedWalks(w).reduce((s, c) => s + (Number(c.miles) || 0), 0);

/** "first"…"tenth", then "11th"… */
export function ordinal(n: number) {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  if (n >= 1 && n <= 10) return words[n];
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th"}`;
}

/** start-new-walk { action: "check" } — can this walker start another walk now? */
export async function checkWalkAgain(): Promise<{ eligible: boolean; reason: string }> {
  try {
    const r: any = await callFunction("start-new-walk", { action: "check" });
    return { eligible: !!r?.eligible, reason: String(r?.reason || "") };
  } catch (e) {
    return { eligible: false, reason: functionError(e) || "Couldn't reach walkforahero.com. Check your connection and try again." };
  }
}

/** start-new-walk { action: "start" } — archive this walk, begin the next for heroId. */
export async function startNewWalk(heroId: string) {
  try {
    const r: any = await callFunction("start-new-walk", { action: "start", hero_id: heroId });
    if (!r?.walker) throw new Error(r?.error || "Your next walk didn't start. Please try again.");
    return r.walker as Walker;
  } catch (e: any) {
    throw new Error(functionError(e) || e?.message || "Couldn't reach walkforahero.com. Check your connection and try again.");
  }
}

export function pledgeSummary(backers: Backer[], miles: number) {
  const open = backers.filter((b) => !b.collected);
  const following = open.filter((b) => !isSettled(b));
  return {
    /** Backers following the current walk. */
    count: backers.filter((b) => !isSettled(b)).length,
    /** Uncollected pledges from earlier walks, still collectible. */
    earlierOpen: open.length - following.length,
    perMile: following.reduce((s, b) => s + Math.min(Number(b.pledge_per_mile) || 0, MAX_PLEDGE_PER_MILE), 0),
    /** Projected, not yet collected — the website labels it the same way. */
    pledgedToCollect: open.reduce((s, b) => s + backerCurrentCharge(b, pledgeMiles(b, miles)), 0),
    /** If the walker finishes all 15 miles of this walk. */
    pledgedAtFinish: open.reduce((s, b) => s + backerCurrentCharge(b, isSettled(b) ? Number(b.final_miles) : MISSION_MILES), 0),
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
