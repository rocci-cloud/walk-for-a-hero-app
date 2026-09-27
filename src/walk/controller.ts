import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import { callFunction, functionError, httpStatus } from "../lib/base44";
import { colors } from "../theme";
import { initialCaptureState, pauseState, resumeState } from "./capture";
import { WALK_LOCATION_TASK } from "./locationTask";
import {
  createWalk,
  getPoints,
  getWalk,
  openWalk,
  setDone,
  setFinishing,
  setPaused,
  setResumed,
  setSendError,
  walkingSeconds,
  type FinishResult,
  type WalkRow,
} from "./store";

/**
 * Start / Pause / Resume / Finish, and sending a finished walk to the same
 * log-walk-miles function the website uses.
 *
 * The app always sends a walk the way the website sends one recorded with no
 * signal: the whole route at Finish, no server session in advance, with a
 * client_token minted at Start and reused for every retry. log-walk-miles
 * creates the session, recomputes the miles from the raw route, and uses the
 * token to guarantee the walk is credited once, however many times it is
 * sent (retries after a timeout, two phones, a double tap).
 */

export class WalkError extends Error {
  constructor(message: string, public readonly action?: "settings") {
    super(message);
  }
}

const TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  activityType: Location.ActivityType.Fitness,
  distanceInterval: 3, // metres
  timeInterval: 2000, // Android: at most every 2 s
  pausesUpdatesAutomatically: false, // iOS must never decide the walker has stopped
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: "Walking for your hero",
    notificationBody: "Recording your route. Open the app to pause or finish.",
    notificationColor: colors.red,
    killServiceOnDestroy: false,
  },
};

export async function ensureLocationPermission() {
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new WalkError("Location Services are off. Turn them on in Settings to record your walk.", "settings");
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    throw new WalkError(
      "Walk For A Hero needs your location to record your walk. Allow location in Settings, then try again.",
      "settings",
    );
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    throw new WalkError(
      Platform.OS === "ios"
        ? "To keep counting with your screen locked, set Location to “Always” for Walk For A Hero in Settings."
        : "To keep counting with your screen off, set Location to “Allow all the time” for Walk For A Hero in Settings.",
      "settings",
    );
  }
}

export function openSettings() {
  Linking.openSettings().catch(() => {});
}

async function startUpdates() {
  if (!(await Location.hasStartedLocationUpdatesAsync(WALK_LOCATION_TASK).catch(() => false))) {
    await Location.startLocationUpdatesAsync(WALK_LOCATION_TASK, TASK_OPTIONS);
  }
}

async function stopUpdates() {
  if (await Location.hasStartedLocationUpdatesAsync(WALK_LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK).catch(() => {});
  }
}

export async function startWalk(ownerEmail: string): Promise<WalkRow> {
  const existing = openWalk();
  if (existing) return existing; // never two walks at once
  await ensureLocationPermission();
  const now = Date.now();
  const walk = createWalk(initialCaptureState(now), ownerEmail, now);
  try {
    await startUpdates();
  } catch {
    throw new WalkError("Your phone wouldn't start GPS. Close other navigation apps and try again.");
  }
  return walk;
}

export async function pauseWalk(id: string) {
  const w = getWalk(id);
  if (!w || w.status !== "active") return;
  await stopUpdates();
  setPaused(id, pauseState(w.capture), Date.now());
}

export async function resumeWalk(id: string) {
  const w = getWalk(id);
  if (!w || w.status !== "paused") return;
  await ensureLocationPermission();
  const now = Date.now();
  setResumed(id, resumeState(w.capture, now), now);
  await startUpdates();
}

/**
 * After a reboot or an app update the OS may have dropped the location task
 * while a walk was still active. Called on launch and on return to the app.
 */
export async function reattachIfWalking() {
  const w = openWalk();
  if (w?.status === "active") await startUpdates().catch(() => {});
}

export type SendOutcome =
  | { kind: "done"; result: FinishResult }
  | { kind: "queued"; message: string }
  | { kind: "needs_sign_in"; message: string }
  | { kind: "rejected"; message: string }
  | { kind: "nothing_recorded" };

export async function finishWalk(id: string): Promise<SendOutcome> {
  const w = getWalk(id);
  if (!w) return { kind: "rejected", message: "This walk could not be found on your phone." };
  if (w.status === "active" || w.status === "paused") {
    await stopUpdates();
    setFinishing(id, Date.now());
  }
  return sendWalk(id);
}

/** Send (or re-send) a finished walk. Safe to call any number of times. */
export async function sendWalk(id: string): Promise<SendOutcome> {
  const w = getWalk(id);
  if (!w) return { kind: "rejected", message: "This walk could not be found on your phone." };
  if (w.status === "done" && w.result) return { kind: "done", result: w.result };

  const path = getPoints(id);
  if (path.length < 2) return { kind: "nothing_recorded" };

  try {
    const res: any = await callFunction("log-walk-miles", {
      path,
      duration_seconds: walkingSeconds(w, Date.now()),
      is_public: false, // live sharing arrives in a later build; private by default
      client_token: w.client_token,
      gap_seconds_total: Math.round(w.capture.gapSecondsTotal),
      gap_count: w.capture.gapCount,
    });
    const session = res?.session || {};
    const result: FinishResult = {
      distance: Number(res?.distance ?? session.distance_miles ?? 0),
      rejected_miles: Number(res?.rejected_miles ?? session.rejected_miles ?? 0),
      flagged_for_review: !!(res?.flagged_for_review ?? session.flagged_for_review),
      flag_reason: String(res?.flag_reason ?? session.flag_reason ?? ""),
      duplicate: !!(res?.duplicate || res?.already_completed),
      miles_walked: typeof res?.walker?.miles_walked === "number" ? res.walker.miles_walked : undefined,
    };
    setDone(id, result);
    return { kind: "done", result };
  } catch (err) {
    const status = httpStatus(err);
    if (status === 401) {
      const message = "Your sign-in has expired. Sign in again and your walk will be sent — it's saved on your phone.";
      setSendError(id, message);
      return { kind: "needs_sign_in", message };
    }
    if (status === null || status === 429 || status >= 500) {
      const message = "Saved on your phone. We'll send it as soon as you're back online.";
      setSendError(id, message);
      return { kind: "queued", message };
    }
    const message =
      functionError(err) || "Walk For A Hero couldn't accept this walk. Your route is saved on your phone.";
    setSendError(id, message);
    return { kind: "rejected", message };
  }
}

/** Retry any walk that finished but hasn't reached the server yet. */
export async function flushPending(): Promise<SendOutcome | null> {
  const w = openWalk();
  if (w?.status !== "finishing") return null;
  return sendWalk(w.id);
}
