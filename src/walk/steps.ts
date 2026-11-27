import { PermissionsAndroid, Platform } from "react-native";
import { iosPedometerBuckets, iosPedometerRequest, iosPedometerTotal } from "../../modules/wfah-background-activity";
import {
  androidLiveSteps,
  androidStepsAvailable,
  androidStepsFlush,
  androidStepSamples,
  androidStepsStart,
  androidStepsStop,
} from "../../modules/wfah-steps";
import type { PathPoint } from "./capture";
import { logDiag } from "./store";

/**
 * Step counter for walks (app 1.0.3, 2026-11-27).
 *
 * WHY: Steve Olds' 1.0.2 report showed iOS suspending the app ~50 s after the
 * screen locked, so GPS missed most of his walk (Apple Watch 1.58 mi, app
 * 0.575 mi). The phone's step counter keeps counting while the app sleeps.
 * At Finish the app sends per-minute step buckets for the walk's GPS span;
 * log-walk-miles calibrates them against the walk's own tracked GPS legs and
 * uses them ONLY to fill signal-loss gaps (never a pause, never beyond the
 * route's first and last fix, capped at walking pace). GPS stays the record.
 *
 *   iPhone:  CMPedometer — steps + Apple's GPS-calibrated distance per
 *            minute, queryable for any window in the last 7 days, so it can
 *            be re-read on every retry of a queued walk.
 *   Android: TYPE_STEP_COUNTER samples kept by the wfah-steps module while
 *            the walk records; steps only, the server converts with the
 *            walker's stored height.
 *
 * Nothing here ever throws or blocks a walk: no permission, no sensor or no
 * data simply means the walk is scored on GPS alone, as before.
 */

/** Ask for Motion & Fitness / Physical activity. Called from the Start tap. */
export async function requestStepPermission(): Promise<string> {
  try {
    if (Platform.OS === "ios") {
      const status = await iosPedometerRequest();
      logDiag("steps_permission", status);
      return status;
    }
    if (Platform.OS === "android") {
      if (!androidStepsAvailable()) {
        logDiag("steps_permission", "unavailable");
        return "unavailable";
      }
      if (Number(Platform.Version) >= 29) {
        const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
        logDiag("steps_permission", String(r));
        return r === PermissionsAndroid.RESULTS.GRANTED ? "authorized" : "denied";
      }
      return "authorized";
    }
  } catch (e: any) {
    logDiag("steps_permission", `error ${String(e?.message || e)}`);
  }
  return "unavailable";
}

/** Android: start counting (reset=true at a new walk's Start). No-op on iOS. */
export function startStepCounting(reset: boolean) {
  if (Platform.OS !== "android") return;
  const ok = androidStepsStart(reset);
  logDiag("steps_start", `reset=${reset} ok=${ok}`);
}

export function stopStepCounting() {
  if (Platform.OS !== "android") return;
  androidStepsStop();
}

type Bucket = { s: string; e: string; steps: number; m?: number };
export type PedometerPayload = {
  source: "ios_cmpedometer" | "android_step_counter";
  status?: string;
  buckets: Bucket[];
  total_steps?: number;
  total_m?: number;
};

const BUCKET_SECONDS = 60;
const MAX_BUCKETS = 1500;

/** Turn cumulative Android samples into step buckets (pure; exported for tests). */
export function bucketsFromSamples(samples: number[][], fromMs: number, toMs: number): Bucket[] {
  const rows = samples
    .filter((r) => Array.isArray(r) && r.length >= 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]))
    .sort((a, b) => a[0] - b[0]);
  const out: Bucket[] = [];
  for (let i = 1; i < rows.length && out.length < MAX_BUCKETS; i++) {
    const [t0, c0] = rows[i - 1];
    const [t1, c1] = rows[i];
    const dt = (t1 - t0) / 1000;
    const steps = c1 - c0;
    // Skip reboots (counter reset), out-of-walk spans and spans the server would refuse.
    if (!(dt > 0) || dt > 600 || steps < 0) continue;
    if (t1 < fromMs || t0 > toMs) continue;
    out.push({ s: new Date(t0).toISOString(), e: new Date(t1).toISOString(), steps });
  }
  return out;
}

/** The step data for a walk, or null when there is none. */
export async function buildPedometer(path: PathPoint[]): Promise<PedometerPayload | null> {
  try {
    if (path.length < 2) return null;
    const fromMs = Date.parse(path[0].t);
    const toMs = Date.parse(path[path.length - 1].t);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || !(toMs > fromMs)) return null;

    if (Platform.OS === "ios") {
      const res = await iosPedometerBuckets(fromMs, toMs, BUCKET_SECONDS);
      if (!res) return null;
      const buckets = (res.buckets || [])
        .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e))
        .sort((a, b) => a.s - b.s)
        .slice(0, MAX_BUCKETS)
        .map((b) => ({
          s: new Date(b.s).toISOString(),
          e: new Date(b.e).toISOString(),
          steps: Math.max(0, Math.round(b.steps || 0)),
          ...(typeof b.m === "number" && Number.isFinite(b.m) ? { m: Number(b.m.toFixed(1)) } : {}),
        }));
      logDiag("steps_read", `status=${res.status} buckets=${buckets.length} steps=${res.total?.steps ?? -1}`);
      if (!buckets.length) return null;
      return {
        source: "ios_cmpedometer",
        status: res.status,
        buckets,
        ...(typeof res.total?.steps === "number" ? { total_steps: Math.round(res.total.steps) } : {}),
        ...(typeof res.total?.m === "number" ? { total_m: Math.round(res.total.m) } : {}),
      };
    }

    if (Platform.OS === "android") {
      androidStepsFlush();
      await new Promise((r) => setTimeout(r, 800)); // let a flushed batch land
      const buckets = bucketsFromSamples(androidStepSamples(), fromMs, toMs);
      const total = buckets.reduce((n, b) => n + b.steps, 0);
      logDiag("steps_read", `buckets=${buckets.length} steps=${total}`);
      if (!buckets.length) return null;
      return { source: "android_step_counter", buckets, total_steps: total };
    }
  } catch (e: any) {
    logDiag("steps_read", `error ${String(e?.message || e)}`);
  }
  return null;
}

/**
 * 1.0.4: steps so far this walk, for the live Steps tile. -1 when the phone
 * has no step counter, permission was refused, or nothing is known yet.
 * iPhone asks the motion coprocessor for the walk's whole span, so the
 * number is right even after the app slept with the screen locked.
 */
export async function liveWalkSteps(startedAtIso: string): Promise<number> {
  try {
    const from = Date.parse(startedAtIso);
    if (!Number.isFinite(from)) return -1;
    if (Platform.OS === "ios") return await iosPedometerTotal(from, Date.now());
    if (Platform.OS === "android") return androidLiveSteps();
  } catch {
    /* display only */
  }
  return -1;
}
