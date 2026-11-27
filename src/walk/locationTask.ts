import * as TaskManager from "expo-task-manager";
import type { LocationObject } from "expo-location";
import { AppState } from "react-native";
import { processFix, type PathPoint } from "./capture";
import { appendPoints, logDiag, openWalk, saveCapture } from "./store";
import { drainLiveFixes, onLiveFixes } from "../../modules/wfah-background-activity";

/**
 * The background location task. Registered at module load from index.ts so
 * the OS can wake the app straight into it (screen locked, app in the
 * background, or even after the app was swiped away on Android, where the
 * foreground service keeps it alive).
 *
 * Location updates are delivered HERE in the foreground too, so this is the
 * one and only path by which a GPS fix becomes part of a walk. The screens
 * read the stored points; they never record their own.
 */
export const WALK_LOCATION_TASK = "wfah-walk-location";

type Listener = () => void;
const listeners = new Set<Listener>();
/** Screens subscribe to redraw as soon as new points land. */
export function onWalkUpdated(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/*
 * Diagnostics (2026-11-24, app 1.0.2). 1.0.1 still lost GPS about a minute
 * after the screen locked for at least one walker. These counters answer the
 * one question the route alone cannot: while the app was NOT in front, did
 * fixes keep arriving here (and were they kept, called noise, or rejected),
 * or did nothing arrive at all? Logged at most once a minute while
 * backgrounded, plus immediately on the first batch after leaving the
 * foreground, plus every app-state change and every process launch.
 */
const BG_LOG_EVERY_MS = 60_000;
let bg = { batches: 0, fixes: 0, points: 0, noise: 0, ignored: 0, lastLogMs: 0, lastFixMs: 0 };
function flushBg(nowMs: number) {
  if (bg.batches === 0) return;
  const lagS = bg.lastFixMs ? Math.round((nowMs - bg.lastFixMs) / 1000) : -1;
  logDiag(
    "bg_fixes",
    `batches=${bg.batches} fixes=${bg.fixes} kept=${bg.points} noise=${bg.noise} ignored=${bg.ignored} lag_s=${lagS}`,
    nowMs,
  );
  bg = { batches: 0, fixes: 0, points: 0, noise: 0, ignored: 0, lastLogMs: nowMs, lastFixMs: 0 };
}

/** Write out any background counters not yet logged (called before a walk is sent). */
export function flushBgDiag() {
  try {
    flushBg(Date.now());
  } catch {
    /* diagnostics only */
  }
}

let lastAppState: string = AppState.currentState ?? "unknown";
try {
  const w = openWalk();
  logDiag("js_launch", `state=${lastAppState} walk=${w ? w.status : "none"}`);
} catch {
  /* diagnostics only */
}
try {
  AppState.addEventListener("change", (next) => {
    if (next === lastAppState) return;
    const now = Date.now();
    flushBg(now);
    if (next !== "active") bg.lastLogMs = 0; // log the first background batch right away
    logDiag("app_state", `${lastAppState}->${next}`, now);
    lastAppState = next;
  });
} catch {
  /* diagnostics only */
}

export function ingestLocations(locations: LocationObject[]) {
  const walk = openWalk();
  if (!walk || walk.status !== "active") return; // paused, finishing or none: ignore stray fixes
  let capture = walk.capture;
  const points: PathPoint[] = [];
  let noise = 0;
  let ignored = 0;
  const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  for (const loc of sorted) {
    const { state, outcome } = processFix(capture, {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      acc: loc.coords.accuracy,
      timeMs: loc.timestamp,
    });
    capture = state;
    if (outcome.kind === "point") points.push(outcome.point);
    else if (outcome.kind === "noise") noise++;
    else ignored++;
  }
  if (points.length) appendPoints(walk.id, points, capture);
  else saveCapture(walk.id, capture);

  const state = AppState.currentState;
  if (state !== "active") {
    const now = Date.now();
    bg.batches++;
    bg.fixes += sorted.length;
    bg.points += points.length;
    bg.noise += noise;
    bg.ignored += ignored;
    if (sorted.length) bg.lastFixMs = sorted[sorted.length - 1].timestamp;
    if (now - bg.lastLogMs >= BG_LOG_EVERY_MS) flushBg(now);
  }
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a screen error must never stop recording */
    }
  });
}

/*
 * 1.0.3 (2026-11-27): on iOS 17+ the walk is recorded natively with Apple's
 * CLLocationUpdate.liveUpdates (modules/wfah-background-activity). Native
 * appends every fix to a file and pings here; this drains the file into the
 * SAME ingestLocations path the expo-location task uses, so capture rules,
 * gap marking, storage and diagnostics are identical. Also drained whenever
 * the app comes to the front and right before a walk is paused or finished,
 * so a fix recorded while JS was suspended (or before a relaunch) is never
 * lost.
 */
let draining: Promise<void> | null = null;
export function drainNativeFixes(): Promise<void> {
  if (draining) return draining;
  draining = (async () => {
    try {
      const rows = await drainLiveFixes();
      if (rows.length) {
        const locations = rows.map(
          (r) =>
            ({
              coords: {
                latitude: r[0],
                longitude: r[1],
                accuracy: r[2],
                speed: typeof r[4] === "number" && r[4] >= 0 ? r[4] : null,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
              },
              timestamp: r[3],
            }) as LocationObject,
        );
        ingestLocations(locations);
      }
    } catch (e: any) {
      logDiag("ingest_error", `native ${String(e?.message || e)}`);
    } finally {
      draining = null;
    }
  })();
  return draining;
}

try {
  onLiveFixes(() => {
    void drainNativeFixes();
  });
  AppState.addEventListener("change", (next) => {
    if (next === "active") void drainNativeFixes();
  });
} catch {
  /* no native module (Android, Expo Go, tests) */
}

if (!TaskManager.isTaskDefined(WALK_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: LocationObject[] }>(WALK_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn("walk location task error", error.message);
      logDiag("task_error", String(error.message || error));
      return;
    }
    const locations = data?.locations;
    if (Array.isArray(locations) && locations.length) {
      try {
        ingestLocations(locations);
      } catch (e: any) {
        console.warn("walk location ingest failed", e);
        logDiag("ingest_error", String(e?.message || e));
      }
    }
  });
}
