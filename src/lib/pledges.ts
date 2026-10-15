/**
 * The pledge money math, and the one place MISSION_MILES is defined.
 *
 * Kept free of imports on purpose, the same way names.ts is: config.ts pulls
 * in react-native (Platform) and data.ts pulls in the Base44 client, and the
 * node test bundle can load neither. These figures are what a walker is told
 * their backers' cards will be charged, so they are the part of this app that
 * most needs tests — and before this file existed they had none.
 *
 * config.ts re-exports MISSION_MILES and data.ts re-exports the rest, so
 * nothing else has to know this file is here.
 */

/** The mission, as the website defines it (src/lib/portal.js on the site). */
export const MISSION_MILES = 15;

/** A single pledge can never be more than this per mile. */
export const MAX_PLEDGE_PER_MILE = 100;
/** Nor more than this in total, however many miles are walked. */
export const MAX_COLLECTED_PER_BACKER = 2000;

type ChargeFields = { pledge_per_mile?: number; max_pledge?: number };
type SettleFields = { final_miles?: number | null };

/**
 * What one backer's card is charged at a given mileage — the website's
 * backerCurrentCharge, so the app and the site always show the same dollars.
 *
 * A backer who set a cap has opted in to however many miles that cap buys,
 * which can be more than 15; the cap, not the mileage, is what stops them.
 */
export function backerCurrentCharge(b: ChargeFields, walkerMiles: number) {
  const perMile = Math.min(Number(b?.pledge_per_mile) || 0, MAX_PLEDGE_PER_MILE);
  const maxPledge = Number(b?.max_pledge) || 0;
  const optedInMiles = perMile > 0 ? Math.max(MISSION_MILES, maxPledge / perMile) : MISSION_MILES;
  const billable = Math.min(Math.max(0, Number(walkerMiles) || 0), optedInMiles);
  const raw = perMile * billable;
  const capped = maxPledge > 0 ? Math.min(raw, maxPledge) : raw;
  return Math.min(capped, MAX_COLLECTED_PER_BACKER);
}

/** A pledge from a finished earlier walk, fixed at the miles then walked. */
export function isSettled(b: SettleFields) {
  return b?.final_miles !== null && b?.final_miles !== undefined;
}

/** The mileage a pledge is charged against: its own, or the walker's now. */
export function pledgeMiles(b: SettleFields, walkerMiles: number) {
  return isSettled(b) ? Number(b.final_miles) : Number(walkerMiles) || 0;
}
