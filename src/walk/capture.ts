/**
 * Walk capture rules — the phone half of the website's GPS pipeline.
 *
 * This is a pure function (no storage, no device APIs) so the exact same
 * decisions happen whether a fix arrives with the app open or in the
 * background task, and so it can be tested in plain Node.
 *
 * It follows the website's LiveWalkTracker.startWatch rules and uses the
 * website's own geo.js (copied byte-for-byte, checksum in src/lib/GEO_SOURCE.md):
 *   1. WARM-UP: fixes are ignored until accuracy < 25 m or 8 s pass
 *      (fixAcceptable); the accuracy ceiling widens the longer nothing is
 *      accepted, so a phone with poor signal records a rough route instead
 *      of nothing.
 *   2. NOISE: a move smaller than the two fixes' combined accuracy is not
 *      travel. It is not stored and the anchor holds (legIsNoise), but it
 *      still proves the phone has signal, so it does not start a gap.
 *   3. GAPS: 60 s or more with no accepted fix (while not paused) is signal
 *      loss. The next fix starts a new line (gap: true) and the lost time is
 *      counted in gap_seconds_total / gap_count, which the server uses to
 *      flag a walk for review.
 *   4. PAUSE / RESUME: a resumed walk also starts a new line (gap: true) but
 *      the paused time is NOT counted as signal loss.
 *
 * Speed checks are NOT done here. log-walk-miles re-runs analyzeOnFoot over
 * the whole path and decides what counts; the phone never decides miles.
 */
import {
  fixAcceptable,
  legIsNoise,
  haversineMiles,
  GPS_GAP_THRESHOLD_SECONDS,
} from "../lib/geo";

export type PathPoint = {
  lat: number;
  lng: number;
  t: string; // ISO time of the fix
  acc: number; // accuracy radius, metres
  gap?: true;
};

export type CaptureState = {
  paused: boolean;
  warmUpStartedAt: number; // ms, when the current GPS watch began (start/resume)
  lastAcceptedAt: number | null; // ms, last fix accepted (including noise fixes)
  anchor: { lat: number; lng: number; acc: number } | null; // last STORED point
  resumePending: boolean; // next stored point re-origins the line after a pause
  gapSecondsTotal: number;
  gapCount: number;
};

export type Fix = { lat: number; lng: number; acc: number | null | undefined; timeMs: number };

export type CaptureOutcome =
  | { kind: "ignored"; reason: "paused" | "inaccurate" }
  | { kind: "noise" }
  | { kind: "point"; point: PathPoint; signalGapSeconds: number };

export function initialCaptureState(nowMs: number): CaptureState {
  return {
    paused: false,
    warmUpStartedAt: nowMs,
    lastAcceptedAt: null,
    anchor: null,
    resumePending: false,
    gapSecondsTotal: 0,
    gapCount: 0,
  };
}

export function pauseState(s: CaptureState): CaptureState {
  return { ...s, paused: true };
}

export function resumeState(s: CaptureState, nowMs: number): CaptureState {
  // Re-origin at wherever the walker is now; warm up again like a fresh start.
  return { ...s, paused: false, warmUpStartedAt: nowMs, lastAcceptedAt: null, anchor: null, resumePending: true };
}

export function processFix(s: CaptureState, fix: Fix): { state: CaptureState; outcome: CaptureOutcome } {
  if (s.paused) return { state: s, outcome: { kind: "ignored", reason: "paused" } };

  const acc = typeof fix.acc === "number" && Number.isFinite(fix.acc) ? fix.acc : Infinity;
  const now = fix.timeMs;
  if (!fixAcceptable(acc, s.warmUpStartedAt, now, s.lastAcceptedAt)) {
    return { state: s, outcome: { kind: "ignored", reason: "inaccurate" } };
  }

  // Signal loss: nothing accepted for 60 s+ while walking (not paused).
  let signalGapSeconds = 0;
  if (s.anchor && s.lastAcceptedAt !== null) {
    const silent = (now - s.lastAcceptedAt) / 1000;
    if (silent >= GPS_GAP_THRESHOLD_SECONDS) signalGapSeconds = silent;
  }

  // Origin (first fix, after a resume, or after signal loss): always stored.
  if (!s.anchor || s.resumePending || signalGapSeconds > 0) {
    const markGap = s.resumePending || signalGapSeconds > 0;
    const point: PathPoint = {
      lat: fix.lat,
      lng: fix.lng,
      t: new Date(now).toISOString(),
      acc,
      ...(markGap ? { gap: true as const } : {}),
    };
    return {
      state: {
        ...s,
        anchor: { lat: fix.lat, lng: fix.lng, acc },
        lastAcceptedAt: now,
        resumePending: false,
        gapSecondsTotal: s.gapSecondsTotal + signalGapSeconds,
        gapCount: s.gapCount + (signalGapSeconds > 0 ? 1 : 0),
      },
      outcome: { kind: "point", point, signalGapSeconds },
    };
  }

  // Positional noise: inside the combined accuracy of the two fixes.
  const d = haversineMiles(s.anchor.lat, s.anchor.lng, fix.lat, fix.lng);
  if (legIsNoise(d, s.anchor.acc, acc)) {
    return { state: { ...s, lastAcceptedAt: now }, outcome: { kind: "noise" } };
  }

  const point: PathPoint = { lat: fix.lat, lng: fix.lng, t: new Date(now).toISOString(), acc };
  return {
    state: { ...s, anchor: { lat: fix.lat, lng: fix.lng, acc }, lastAcceptedAt: now },
    outcome: { kind: "point", point, signalGapSeconds: 0 },
  };
}
