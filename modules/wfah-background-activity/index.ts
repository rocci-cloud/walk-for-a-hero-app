import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * iOS background-activity session for an active walk. See
 * ios/WfahBackgroundActivityModule.swift for why it exists.
 *
 * Optional on purpose: Android, web, Expo Go and the Node test runner have no
 * native module, and recording must never fail because this is missing.
 */
type Native = { start(): Promise<boolean>; stop(): Promise<void> };

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
