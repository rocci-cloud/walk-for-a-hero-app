/**
 * Turning a person's full name into the short forms the app shows.
 *
 * Kept free of imports on purpose: data.ts pulls in the Base44 client and the
 * React Native runtime, which the node test bundle cannot load. These two are
 * pure string functions, so they live here and data.ts re-exports them.
 */

/** Tokens like "SSgt.", "Dr." and the middle initial "L." — never the name. */
const isTitleOrInitial = (part: string) => part.endsWith(".");

/**
 * The name to address someone by, skipping a rank or title and middle
 * initials.
 *
 * Every hero screen used `name.split(" ")[0]`, which is right for "Joshua L.
 * Holm" and wrong for any veteran carrying a rank: "SSgt. Robert Ng" came out
 * as "SSgt.", so the app read "Give to SSgt." and "15 miles for SSgt." Hero #1
 * has no rank, which is why it went unseen (audit, 2026-10-05).
 */
export const firstName = (name?: string, fallback = "your hero") =>
  (name || "").split(/\s+/).find((p) => p && !isTitleOrInitial(p)) || fallback;

/** First and last name initials; titles and middle initials are skipped. */
export const initials = (name?: string) => {
  const parts = (name || "").split(/\s+/).filter((p) => p && !isTitleOrInitial(p));
  const pick = parts.length > 2 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 2);
  return pick.map((p) => p[0]!.toUpperCase()).join("") || "W";
};
