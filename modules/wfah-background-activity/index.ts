import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * iOS background-activity session for an active walk, plus the native half of
 * the walk diagnostics (2026-11-24). See ios/WfahBackgroundActivityModule.swift.
 *
 * Optional on purpose: Android, web, Expo Go and the Node test runner have no
 * native module, and recording must never fail because this is missing.
 */
type Native = {
  start(): Promise<boolean>;
  stop(): Promise<void>;
  startLive(reason: string): Promise<boolean>;
  stopLive(): Promise<void>;
  drainFixes(): Promise<number[][]>;
  isLive(): Promise<boolean>;
  pedometerStatus(): Promise<string>;
  pedometerRequest(): Promise<string>;
  pedometerBuckets(
    startMs: number,
    endMs: number,
    bucketSeconds: number,
  ): Promise<{ status: string; buckets: { s: number; e: number; steps: number; m?: number }[]; total?: { steps?: number; m?: number } }>;
  pedometerTotal(startMs: number, endMs: number): Promise<{ steps: number; m?: number }>;
  snapshot(dbPath: string | null): Promise<Record<string, unknown>>;
  drainEvents(): Promise<string[]>;
  addListener?(event: "onFixes", cb: (e: { at: number }) => void): { remove(): void };
};

const native =
  Platform.OS === "ios" ? requireOptionalNativeModule<Native>("WfahBackgroundActivity") : null;

/** Hold the session. Call from the foreground (Start / Resume / relaunch). */
export async function startBackgroundActivity(): Promise<boolean> {
  try {
    return (await native?.start()) ?? false;
  } catch {
    return false;
  }
}

/** Release the session (Pause / Finish / discard). */
export async function stopBackgroundActivity(): Promise<void> {
  try {
    await native?.stop();
  } catch {
    /* never block stopping a walk */
  }
}

/**
 * 1.0.3: record the walk natively with Apple's CLLocationUpdate.liveUpdates
 * inside the background-activity session (iOS 17+). Returns false where that
 * is unavailable (older iOS, Android, Expo Go) so the caller falls back to the
 * expo-location task.
 */
export async function startLiveLocation(reason: string): Promise<boolean> {
  try {
    return (await native?.startLive(reason)) ?? false;
  } catch {
    return false;
  }
}

export async function stopLiveLocation(): Promise<void> {
  try {
    await native?.stopLive();
  } catch {
    /* never block stopping a walk */
  }
}

export async function liveLocationRunning(): Promise<boolean> {
  try {
    return (await native?.isLive()) ?? false;
  } catch {
    return false;
  }
}

/** Native fixes not yet ingested: [lat, lng, accuracyM, epochMs, speed]. */
export async function drainLiveFixes(): Promise<number[][]> {
  try {
    return native ? await native.drainFixes() : [];
  } catch {
    return [];
  }
}

/** Called (throttled ~1.5 s) whenever native has recorded new fixes. */
export function onLiveFixes(fn: () => void): () => void {
  try {
    const sub = native?.addListener?.("onFixes", () => fn());
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}

export const iosNativeAvailable = !!native;

/** Motion & Fitness: "authorized" | "denied" | "restricted" | "notDetermined" | "unavailable". */
export async function iosPedometerRequest(): Promise<string> {
  try {
    return (await native?.pedometerRequest()) ?? "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function iosPedometerBuckets(startMs: number, endMs: number, bucketSeconds = 60) {
  try {
    return native ? await native.pedometerBuckets(startMs, endMs, bucketSeconds) : null;
  } catch {
    return null;
  }
}

/** 1.0.4: steps between two times (live Steps tile). -1 when unavailable. */
export async function iosPedometerTotal(startMs: number, endMs: number): Promise<number> {
  try {
    const r = native ? await native.pedometerTotal(startMs, endMs) : null;
    return typeof r?.steps === "number" ? r.steps : -1;
  } catch {
    return -1;
  }
}

/** Device/app/permission facts, or null where the native module is absent. */
export async function nativeSnapshot(dbPath: string | null): Promise<Record<string, unknown> | null> {
  try {
    return native ? await native.snapshot(dbPath) : null;
  } catch {
    return null;
  }
}

/** Native lifecycle events ("epochMs|kind|detail"), cleared once read. */
export async function drainNativeEvents(): Promise<string[]> {
  try {
    return native ? await native.drainEvents() : [];
  } catch {
    return [];
  }
}
