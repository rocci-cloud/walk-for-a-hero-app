import { haversineMiles } from "../lib/geo";
import type { PathPoint } from "./capture";

export type Split = { mile: number; fraction: number; seconds: number };

/**
 * Mile splits from the route stored on the phone: time taken for each whole
 * mile, plus the last partial mile. Legs across a gap (signal loss or a pause)
 * add neither distance nor time, the same way the credited miles treat them.
 * Display only — the server's figure is what counts.
 */
export function mileSplits(points: PathPoint[], milesBefore = 0): Split[] {
  const splits: Split[] = [];
  const base = Math.floor(milesBefore);
  const offset = milesBefore - base; // part of the current mission mile already walked
  let miles = 0;
  let secs = 0;
  let splitStartMiles = 0;
  let splitStartSecs = 0;
  let boundary = 1 - offset; // walk distance at which the current mission mile completes
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.gap) continue;
    const d = haversineMiles(a.lat, a.lng, b.lat, b.lng);
    const dt = Math.max(0, (Date.parse(b.t) - Date.parse(a.t)) / 1000);
    if (dt > 0 && d / (dt / 3600) > 15) continue; // faster than on foot: not a walking leg
    while (d > 0 && miles + d >= boundary) {
      const f = (boundary - miles) / d;
      const tAt = secs + dt * f;
      splits.push({ mile: base + splits.length + 1, fraction: boundary - splitStartMiles, seconds: tAt - splitStartSecs });
      splitStartMiles = boundary;
      splitStartSecs = tAt;
      boundary += 1;
    }
    miles += d;
    secs += dt;
  }
  const rest = miles - splitStartMiles;
  if (rest > 0.05) splits.push({ mile: base + splits.length + 1, fraction: rest, seconds: secs - splitStartSecs });
  return splits;
}

export function formatSplit(seconds: number, fraction: number) {
  const perMile = fraction > 0 ? seconds / fraction : seconds;
  const m = Math.floor(perMile / 60);
  const s = Math.round(perMile % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
