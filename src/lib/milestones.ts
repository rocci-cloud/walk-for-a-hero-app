/**
 * The miles worth marking on the way to the goal.
 *
 * The route art is the strongest thing a walker can share, and before this it
 * appeared once, at 15 miles — by which point every backer they were going to
 * recruit had already been recruited. 5 and 10 are the two points where a
 * walker has something real to show and still has miles left to be backed on.
 *
 * Pure and import-free so the node tests can load it (see names.ts).
 */

import { MISSION_MILES } from "./pledges";

/** Marked on the way up. The goal itself gets its own full-screen moment. */
export const MILESTONES = [5, 10] as const;

/**
 * The milestone this walk crossed, or null.
 *
 * Takes the walker's total before and after the walk, not the walk's own
 * distance: the fifth mile counts whether it came in one walk or a fifth of
 * one. A long walk that passes both 5 and 10 marks the higher of the two —
 * one moment per walk, and the bigger number is the better one to share.
 *
 * A milestone at or past the goal is skipped, so a walker whose goal is 10
 * does not get a milestone card and a finish card for the same mile.
 */
export function milestoneCrossed(before: number, after: number, goal: number = MISSION_MILES): number | null {
  const from = Number(before) || 0;
  const to = Number(after) || 0;
  if (to <= from) return null;
  const crossed = MILESTONES.filter((m) => m < goal && from < m && to >= m);
  return crossed.length ? crossed[crossed.length - 1] : null;
}
