import * as Location from "expo-location";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { drainNativeEvents, nativeSnapshot } from "../../modules/wfah-background-activity";
import { flushBgDiag } from "./locationTask";
import { databaseFilePath, diagEventsBetween, logDiag, type WalkRow } from "./store";

/**
 * The diagnostics report sent with every finished walk (2026-11-24, app 1.0.2).
 *
 * WHY: app 1.0.1 still lost GPS about a minute after the screen locked for at
 * least one iPhone walker (Steve Olds, 7 gaps a walk), although the code path
 * is correct on paper. Only the phone can say whether iOS killed the app,
 * stopped delivering location, or locked the app's files. log-walk-miles
 * stores this as WalkSession.client_diagnostics; nothing credits from it.
 *
 * Contents: device/app/permission snapshot, plus a time-ordered event log
 * covering the walk — process launches, foreground/background changes, GPS
 * batches received while backgrounded (kept / noise / rejected), task and
 * ingest errors, background-session start/stop, and native lifecycle events
 * (memory warnings, termination, file-protection lock/unlock, Low Power Mode
 * changes). Event times are seconds from the walk's start.
 *
 * Never throws: a walk must always be sendable without its report.
 */
const MAX_EVENTS = 450;
const MAX_JSON_CHARS = 19_000;

/** Move native events (kept in UserDefaults across process deaths) into SQLite. */
export async function absorbNativeEvents() {
  const lines = await drainNativeEvents();
  for (const line of lines) {
    const [ms, kind, ...rest] = line.split("|");
    const t = Number(ms);
    if (Number.isFinite(t) && kind) logDiag(kind, rest.join("|"), t);
  }
}

export async function buildDiagnostics(w: WalkRow): Promise<Record<string, unknown> | null> {
  try {
    flushBgDiag();
    await absorbNativeEvents();
    const startMs = Date.parse(w.started_at) || Date.now();
    const now = Date.now();

    let permission: Record<string, unknown> = {};
    try {
      const p: any = await Location.getForegroundPermissionsAsync();
      permission = { status: p?.status, ios_scope: p?.ios?.scope, android_accuracy: p?.android?.accuracy };
    } catch {
      /* optional */
    }

    const device =
      (await nativeSnapshot(databaseFilePath())) ?? {
        os: Platform.OS,
        os_version: String(Platform.Version),
        app_version: Constants.expoConfig?.version ?? "",
      };

    let events = diagEventsBetween(startMs - 60_000, now, 2000);
    let dropped = 0;
    if (events.length > MAX_EVENTS) {
      // Keep the start and the end of the walk; the middle repeats itself.
      dropped = events.length - MAX_EVENTS;
      const head = Math.floor(MAX_EVENTS / 2);
      events = [...events.slice(0, head), ...events.slice(events.length - (MAX_EVENTS - head))];
    }

    const count = (k: string) => events.filter((e) => e.k === k).length;
    const report = (list: typeof events) => ({
      v: 1,
      walk_started_at: w.started_at,
      sent_at: new Date(now).toISOString(),
      device,
      permission,
      summary: {
        js_launches: count("js_launch"),
        native_starts: count("native_start"),
        backgrounded: count("n_background"),
        memory_warnings: count("n_memory_warning"),
        terminations: count("n_terminate"),
        files_locked: count("n_files_locked"),
        bg_fix_reports: count("bg_fixes"),
        task_errors: count("task_error") + count("ingest_error"),
        events_dropped: dropped + (events.length - list.length),
      },
      // [seconds from start, kind, detail]
      events: list.map((e) => [Math.round((e.t - startMs) / 1000), e.k, e.d]),
    });
    // The server keeps at most 20,000 characters; stay under it with whole JSON.
    let list = events;
    let out = report(list);
    while (JSON.stringify(out).length > MAX_JSON_CHARS && list.length > 20) {
      const keep = Math.floor(list.length * 0.8);
      const head = Math.floor(keep / 2);
      list = [...list.slice(0, head), ...list.slice(list.length - (keep - head))];
      out = report(list);
    }
    return out;
  } catch {
    return null;
  }
}
