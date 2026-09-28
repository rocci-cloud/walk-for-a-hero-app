import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type { CaptureState, PathPoint } from "./capture";
import { base64UrlFromBytes } from "../lib/pkce";

/**
 * On-device walk storage (SQLite).
 *
 * Every accepted GPS point is written to the phone the moment it arrives —
 * from the foreground or from the background task — so a walk survives the
 * app being killed, the phone rebooting, or no signal from start to finish.
 * Nothing is sent to the server until Finish, and a finish that can't reach
 * the server waits here (status 'finishing') and is retried with the SAME
 * client_token, which log-walk-miles uses to make sure a walk is credited
 * exactly once no matter how many times it is sent.
 *
 * One walk is open at a time. Finished walks are pruned after 30 days.
 */

export type WalkStatus = "active" | "paused" | "finishing" | "done";

export type WalkRow = {
  id: string;
  client_token: string;
  status: WalkStatus;
  started_at: string;
  capture: CaptureState;
  active_ms: number; // time spent walking (not paused), completed segments
  active_since: number | null; // ms when the current walking segment began
  result: FinishResult | null;
  last_error: string | null;
  owner_email: string;
};

export type FinishResult = {
  distance: number;
  rejected_miles: number;
  flagged_for_review: boolean;
  flag_reason: string;
  duplicate?: boolean;
  miles_walked?: number;
};

let db: SQLite.SQLiteDatabase | null = null;

function database() {
  if (db) return db;
  db = SQLite.openDatabaseSync("walks.db");
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS walks (
      id TEXT PRIMARY KEY NOT NULL,
      client_token TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      capture_json TEXT NOT NULL,
      active_ms INTEGER NOT NULL DEFAULT 0,
      active_since INTEGER,
      result_json TEXT,
      last_error TEXT,
      owner_email TEXT NOT NULL DEFAULT '',
      created_ms INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS points (
      walk_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      t TEXT NOT NULL,
      acc REAL NOT NULL,
      gap INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (walk_id, seq)
    );
  `);
  return db;
}

function rowToWalk(r: any): WalkRow {
  return {
    id: r.id,
    client_token: r.client_token,
    status: r.status,
    started_at: r.started_at,
    capture: JSON.parse(r.capture_json),
    active_ms: r.active_ms,
    active_since: r.active_since ?? null,
    result: r.result_json ? JSON.parse(r.result_json) : null,
    last_error: r.last_error ?? null,
    owner_email: r.owner_email || "",
  };
}

export function newToken(bytes = 24) {
  return base64UrlFromBytes(Crypto.getRandomBytes(bytes));
}

/** The walk that is active, paused or waiting to be sent — at most one. */
export function openWalk(): WalkRow | null {
  const r = database().getFirstSync(
    "SELECT * FROM walks WHERE status IN ('active','paused','finishing') ORDER BY created_ms DESC LIMIT 1",
  );
  return r ? rowToWalk(r) : null;
}

export function getWalk(id: string): WalkRow | null {
  const r = database().getFirstSync("SELECT * FROM walks WHERE id = ?", [id]);
  return r ? rowToWalk(r) : null;
}

export function createWalk(capture: CaptureState, ownerEmail: string, nowMs: number): WalkRow {
  const id = newToken(12);
  const clientToken = newToken(24); // 32 chars; log-walk-miles keeps up to 64
  database().runSync(
    `INSERT INTO walks (id, client_token, status, started_at, capture_json, active_ms, active_since, owner_email, created_ms)
     VALUES (?, ?, 'active', ?, ?, 0, ?, ?, ?)`,
    [id, clientToken, new Date(nowMs).toISOString(), JSON.stringify(capture), nowMs, ownerEmail, nowMs],
  );
  return getWalk(id)!;
}

export function saveCapture(id: string, capture: CaptureState) {
  database().runSync("UPDATE walks SET capture_json = ? WHERE id = ?", [JSON.stringify(capture), id]);
}

/** Append points and the capture state that produced them, atomically. */
export function appendPoints(id: string, points: PathPoint[], capture: CaptureState) {
  const d = database();
  d.withTransactionSync(() => {
    const row: any = d.getFirstSync("SELECT COALESCE(MAX(seq), -1) AS m FROM points WHERE walk_id = ?", [id]);
    let seq = (row?.m ?? -1) + 1;
    for (const p of points) {
      d.runSync(
        "INSERT INTO points (walk_id, seq, lat, lng, t, acc, gap) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, seq++, p.lat, p.lng, p.t, p.acc, p.gap ? 1 : 0],
      );
    }
    d.runSync("UPDATE walks SET capture_json = ? WHERE id = ?", [JSON.stringify(capture), id]);
  });
}

export function getPoints(id: string): PathPoint[] {
  const rows: any[] = database().getAllSync(
    "SELECT lat, lng, t, acc, gap FROM points WHERE walk_id = ? ORDER BY seq",
    [id],
  );
  return rows.map((r) => ({ lat: r.lat, lng: r.lng, t: r.t, acc: r.acc, ...(r.gap ? { gap: true as const } : {}) }));
}

export function setPaused(id: string, capture: CaptureState, nowMs: number) {
  const w = getWalk(id);
  if (!w) return;
  const add = w.active_since ? Math.max(0, nowMs - w.active_since) : 0;
  database().runSync(
    "UPDATE walks SET status = 'paused', capture_json = ?, active_ms = active_ms + ?, active_since = NULL WHERE id = ?",
    [JSON.stringify(capture), add, id],
  );
}

export function setResumed(id: string, capture: CaptureState, nowMs: number) {
  database().runSync(
    "UPDATE walks SET status = 'active', capture_json = ?, active_since = ? WHERE id = ?",
    [JSON.stringify(capture), nowMs, id],
  );
}

/** Close the walking clock and mark the walk as waiting to be sent. */
export function setFinishing(id: string, nowMs: number) {
  const w = getWalk(id);
  if (!w) return;
  const add = w.active_since ? Math.max(0, nowMs - w.active_since) : 0;
  database().runSync(
    "UPDATE walks SET status = 'finishing', active_ms = active_ms + ?, active_since = NULL WHERE id = ?",
    [add, id],
  );
}

export function setSendError(id: string, message: string) {
  database().runSync("UPDATE walks SET last_error = ? WHERE id = ?", [message.slice(0, 300), id]);
}

export function setDone(id: string, result: FinishResult) {
  database().runSync("UPDATE walks SET status = 'done', result_json = ?, last_error = NULL WHERE id = ?", [
    JSON.stringify(result),
    id,
  ]);
}

/** Walker chose to throw a walk away. Only offered for walks that were never sent successfully. */
export function discardWalk(id: string) {
  const d = database();
  d.withTransactionSync(() => {
    d.runSync("DELETE FROM points WHERE walk_id = ?", [id]);
    d.runSync("DELETE FROM walks WHERE id = ?", [id]);
  });
}

/** Keep the phone tidy: forget finished walks (and their routes) after 30 days. */
export function pruneFinished(nowMs: number) {
  const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
  const d = database();
  d.withTransactionSync(() => {
    d.runSync(
      "DELETE FROM points WHERE walk_id IN (SELECT id FROM walks WHERE status = 'done' AND created_ms < ?)",
      [cutoff],
    );
    d.runSync("DELETE FROM walks WHERE status = 'done' AND created_ms < ?", [cutoff]);
  });
}

/** Signing out (or deleting the account) removes every walk from this phone. */
export function wipeAll() {
  const d = database();
  d.withTransactionSync(() => {
    d.runSync("DELETE FROM points");
    d.runSync("DELETE FROM walks");
  });
}

export function walkingSeconds(w: WalkRow, nowMs: number) {
  const live = w.active_since ? Math.max(0, nowMs - w.active_since) : 0;
  return Math.round((w.active_ms + live) / 1000);
}

/** Recently credited walks still on this phone (newest first), for replays. */
export function recentDone(limit = 5): WalkRow[] {
  const rows = database().getAllSync(
    "SELECT * FROM walks WHERE status = 'done' ORDER BY created_ms DESC LIMIT ?",
    [limit],
  );
  return rows.map(rowToWalk);
}
