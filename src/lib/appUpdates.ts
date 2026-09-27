import * as Updates from "expo-updates";
import { openWalk } from "../walk/store";

/**
 * Apply an over-the-air fix on the FIRST open instead of the second.
 *
 * By default expo-updates downloads a new update in the background and only
 * runs it on the next cold start, so a fix needed two full restarts to reach
 * the phone. On launch this checks, downloads, and restarts the JavaScript
 * straight away. It never restarts while a walk is open on the phone, so a
 * walk in progress is never interrupted.
 */
export async function applyUpdateNow() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return;
    const w = openWalk();
    if (w && w.status !== "done") return; // it will run on the next launch instead
    await Updates.reloadAsync();
  } catch {
    // Offline or the update server is down: keep running what we have.
  }
}

/** Short label for which code the phone is running, shown on sign-in and Account. */
export function runningVersion() {
  const id = Updates.updateId;
  return id ? `update ${id.slice(0, 8)}` : "built-in";
}
