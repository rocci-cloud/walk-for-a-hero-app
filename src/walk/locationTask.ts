import * as TaskManager from "expo-task-manager";
import type { LocationObject } from "expo-location";
import { processFix, type PathPoint } from "./capture";
import { appendPoints, openWalk, saveCapture } from "./store";

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

export function ingestLocations(locations: LocationObject[]) {
  const walk = openWalk();
  if (!walk || walk.status !== "active") return; // paused, finishing or none: ignore stray fixes
  let capture = walk.capture;
  const points: PathPoint[] = [];
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
  }
  if (points.length) appendPoints(walk.id, points, capture);
  else saveCapture(walk.id, capture);
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a screen error must never stop recording */
    }
  });
}

if (!TaskManager.isTaskDefined(WALK_LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: LocationObject[] }>(WALK_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn("walk location task error", error.message);
      return;
    }
    const locations = data?.locations;
    if (Array.isArray(locations) && locations.length) {
      try {
        ingestLocations(locations);
      } catch (e) {
        console.warn("walk location ingest failed", e);
      }
    }
  });
}
