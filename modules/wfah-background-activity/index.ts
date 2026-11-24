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
  snapshot(dbPath: string | null): Promise<Record<string, unknown>>;
  drainEvents(): Promise<string[]>;
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
