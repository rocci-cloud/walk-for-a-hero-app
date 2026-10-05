import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { initialCaptureState, processFix, pauseState, resumeState, type CaptureState, type PathPoint } from "../src/walk/capture";
import { analyzeOnFoot } from "../src/lib/geo";
import { base64UrlFromBytes, base64ToBase64Url, parseAuthCallback, CODE_RE } from "../src/lib/pkce";
import { firstName, formalName, initials } from "../src/lib/names";

// ---------- helpers ----------
const M_PER_DEG_LAT = 111_320;
const START = { lat: 27.9506, lng: -82.4572 }; // Tampa
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
function feed(state: CaptureState, fixes: { lat: number; lng: number; acc: number; timeMs: number }[]) {
  const points: PathPoint[] = [];
  let s = state;
  for (const f of fixes) {
    const r = processFix(s, f);
    s = r.state;
    if (r.outcome.kind === "point") points.push(r.outcome.point);
  }
  return { state: s, points };
}
/** Walk due north at `mph`, a fix every `everyS` seconds, GPS noise up to `noiseM`. */
function walkNorth(from: { lat: number; lng: number }, miles: number, mph: number, t0: number, everyS = 2, noiseM = 4, acc = 8, seed = 7) {
  const rnd = seeded(seed);
  const totalS = (miles / mph) * 3600;
  const out = [];
  for (let s = 0; s <= totalS; s += everyS) {
    const dM = (s / totalS) * miles * 1609.344;
    const nLat = (rnd() - 0.5) * 2 * noiseM;
    const nLng = (rnd() - 0.5) * 2 * noiseM;
    out.push({
      lat: from.lat + (dM + nLat) / M_PER_DEG_LAT,
      lng: from.lng + nLng / (M_PER_DEG_LAT * Math.cos((from.lat * Math.PI) / 180)),
      acc,
      timeMs: t0 + s * 1000,
    });
  }
  return out;
}

// ---------- capture rules ----------
test("warm-up: coarse fixes are ignored until a satellite lock or 8 s", () => {
  const t0 = 1_000_000;
  const s0 = initialCaptureState(t0);
  const coarse = processFix(s0, { ...START, acc: 60, timeMs: t0 + 2000 });
  assert.equal(coarse.outcome.kind, "ignored");
  const locked = processFix(s0, { ...START, acc: 10, timeMs: t0 + 2000 });
  assert.equal(locked.outcome.kind, "point");
  const afterWait = processFix(s0, { ...START, acc: 60, timeMs: t0 + 9000 });
  assert.equal(afterWait.outcome.kind, "point", "after 8 s a 60 m fix is accepted (ceiling is 70 m)");
});

test("noise: standing still produces no route points after the origin", () => {
  const t0 = 2_000_000;
  const rnd = seeded(3);
  const fixes = Array.from({ length: 60 }, (_, i) => ({
    lat: START.lat + ((rnd() - 0.5) * 8) / M_PER_DEG_LAT,
    lng: START.lng + ((rnd() - 0.5) * 8) / M_PER_DEG_LAT,
    acc: 10,
    timeMs: t0 + 1000 + i * 2000,
  }));
  const { points } = feed(initialCaptureState(t0), fixes);
  assert.equal(points.length, 1, "only the origin is stored while standing in one spot");
});

test("a 1-mile walk at 3 mph with GPS jitter is credited within 3% by the server's own analysis", () => {
  const t0 = 3_000_000;
  const { points, state } = feed(initialCaptureState(t0), walkNorth(START, 1, 3, t0 + 1000));
  const a = analyzeOnFoot(points);
  assert.ok(Math.abs(a.miles - 1) < 0.03, `credited ${a.miles}`);
  assert.equal(a.flagged, false);
  assert.equal(state.gapCount, 0);
});

test("signal loss of 90 s breaks the line and is counted as a gap", () => {
  const t0 = 4_000_000;
  const first = walkNorth(START, 0.1, 3, t0 + 1000, 2, 3, 8, 11);
  const last = first[first.length - 1];
  const resumeAt = last.timeMs + 90_000;
  const second = walkNorth({ lat: last.lat + 70 / M_PER_DEG_LAT, lng: START.lng }, 0.1, 3, resumeAt, 2, 3, 8, 12);
  const { points, state } = feed(initialCaptureState(t0), [...first, ...second]);
  const gaps = points.filter((p) => p.gap);
  assert.equal(gaps.length, 1);
  assert.equal(state.gapCount, 1);
  assert.ok(state.gapSecondsTotal >= 90 && state.gapSecondsTotal < 95, `gap seconds ${state.gapSecondsTotal}`);
});

test("pause/resume breaks the line but is NOT counted as signal loss", () => {
  const t0 = 5_000_000;
  let { state, points } = feed(initialCaptureState(t0), walkNorth(START, 0.05, 3, t0 + 1000, 2, 3, 8, 21));
  state = pauseState(state);
  const ignored = processFix(state, { ...START, acc: 5, timeMs: t0 + 400_000 });
  assert.equal(ignored.outcome.kind, "ignored");
  const resumeT = t0 + 10 * 60_000;
  state = resumeState(state, resumeT);
  const more = feed(state, walkNorth({ lat: START.lat + 0.001, lng: START.lng }, 0.05, 3, resumeT + 1000, 2, 3, 8, 22));
  const all = [...points, ...more.points];
  assert.equal(all.filter((p) => p.gap).length, 1, "the resumed line starts with a gap marker");
  assert.equal(more.state.gapCount, 0, "10 minutes paused is not signal loss");
});

test("a mile driven at 30 mph inside a walk is recorded but rejected by the server's analysis", () => {
  const t0 = 6_000_000;
  const walk1 = walkNorth(START, 0.5, 3, t0 + 1000, 2, 3, 8, 31);
  const e1 = walk1[walk1.length - 1];
  const drive = walkNorth({ lat: e1.lat, lng: START.lng }, 1, 30, e1.timeMs + 2000, 2, 3, 8, 32);
  const e2 = drive[drive.length - 1];
  const walk2 = walkNorth({ lat: e2.lat, lng: START.lng }, 0.5, 3, e2.timeMs + 2000, 2, 3, 8, 33);
  const { points } = feed(initialCaptureState(t0), [...walk1, ...drive, ...walk2]);
  const a = analyzeOnFoot(points);
  assert.ok(a.miles > 0.9 && a.miles < 1.15, `credited ${a.miles} of 1.0 walked`);
  assert.ok(a.rejectedMiles > 0.85, `rejected ${a.rejectedMiles} of 1.0 driven`);
});

test("every stored point carries what log-walk-miles needs (lat, lng, ISO t, acc)", () => {
  const t0 = 7_000_000;
  const { points } = feed(initialCaptureState(t0), walkNorth(START, 0.25, 3, t0 + 1000));
  // ~400 m; the noise rule stores a point per ~16 m of real movement at 8 m accuracy
  assert.ok(points.length > 15, `stored ${points.length}`);
  for (const p of points) {
    assert.equal(typeof p.lat, "number");
    assert.equal(typeof p.lng, "number");
    assert.ok(!Number.isNaN(Date.parse(p.t)) && p.t.endsWith("Z"));
    assert.equal(typeof p.acc, "number");
  }
});

// ---------- PKCE (must match the website's app-auth-handoff) ----------
test("RFC 7636 Appendix B test vector", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = base64ToBase64Url(createHash("sha256").update(verifier).digest("base64"));
  assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("base64url of random bytes matches Node's encoder for every length", () => {
  for (let n = 0; n < 70; n++) {
    const b = randomBytes(n);
    assert.equal(base64UrlFromBytes(new Uint8Array(b)), b.toString("base64url"));
  }
  assert.ok(CODE_RE.test(base64UrlFromBytes(new Uint8Array(randomBytes(32)))), "a 32-byte code is 43 chars");
});

test("the app only accepts a callback carrying ITS state and a well-formed code", () => {
  const code = base64UrlFromBytes(new Uint8Array(randomBytes(32)));
  assert.deepEqual(parseAuthCallback(`walkforahero://auth?code=${code}&state=abcdefghijklmnop`, "abcdefghijklmnop"), { code });
  assert.deepEqual(parseAuthCallback(`walkforahero://auth?code=${code}&state=someone-elses-state`, "abcdefghijklmnop"), { error: "state_mismatch" });
  assert.deepEqual(parseAuthCallback(`walkforahero://auth?code=short&state=abcdefghijklmnop`, "abcdefghijklmnop"), { error: "bad_code" });
});

import { mileSplits } from "../src/walk/splits";

test("mile splits follow mission miles, not walk miles", () => {
  // 3.0 mi due north at 9:00/mi, starting at mission mile 6.4
  const t0 = Date.parse("2026-09-28T10:00:00Z");
  const pts = Array.from({ length: 61 }, (_, i) => ({ lat: 28 + (i * 0.05) / 69.05, lng: -82, t: new Date(t0 + i * 27000).toISOString(), acc: 5 }));
  const s = mileSplits(pts, 6.4);
  assert.deepEqual(s.map((x) => x.mile), [7, 8, 9, 10]);
  assert.deepEqual(s.map((x) => +x.fraction.toFixed(2)), [0.6, 1, 1, 0.4]);
  assert.ok(Math.abs(s[1].seconds - 540) < 3);
});

test("a gap adds neither distance nor time", () => {
  const t0 = Date.parse("2026-09-28T10:00:00Z");
  const pts: any[] = Array.from({ length: 21 }, (_, i) => ({ lat: 28 + (i * 0.05) / 69.05, lng: -82, t: new Date(t0 + i * 27000).toISOString(), acc: 5 }));
  pts[10] = { ...pts[10], gap: true, t: new Date(t0 + 10 * 27000 + 3600000).toISOString() };
  for (let i = 11; i < 21; i++) pts[i].t = new Date(Date.parse(pts[i].t) + 3600000).toISOString();
  const total = mileSplits(pts, 0).reduce((a, x) => a + x.fraction, 0);
  assert.ok(Math.abs(total - 0.95) < 0.01);
});

// ---------- addressing a hero by name ----------

test("a hero's first name skips rank and middle initials", () => {
  // Every hero screen used name.split(" ")[0], which reads a rank as the
  // first name: "Give to SSgt." instead of "Give to Robert".
  assert.equal(firstName("SSgt. Robert Ng"), "Robert");
  assert.equal(firstName("Joshua L. Holm"), "Joshua");
  // A multi-word rank ("Sgt. 1st Class") still is not fully understood — the
  // rank simply stops being mistaken for the name. Storing rank as its own
  // Hero field is the real fix; see the audit notes.
  assert.notEqual(firstName("Sgt. 1st Class Dana Ruiz"), "Sgt.");
  assert.equal(firstName("Maria Russo"), "Maria");
  assert.equal(firstName(""), "your hero");
  assert.equal(firstName(undefined), "your hero");
  assert.equal(firstName("Dr. Jane Smith", "a backer"), "Jane");
});

test("initials agree with firstName about what is a title", () => {
  assert.equal(initials("SSgt. Robert Ng"), "RN");
  assert.equal(initials("Joshua L. Holm"), "JH");
});

/* Rank now lives in its own field (Hero.rank) and the name field holds only
   the person's name. These cover the composition and the safety net for a
   record that still carries the old embedded shape. */
test("formalName puts the rank in front of the name", () => {
  // Spelled out is how ranks are stored; abbreviated is still handled.
  assert.equal(formalName("Robert Ng", "Staff Sergeant"), "Staff Sergeant Robert Ng");
  assert.equal(formalName("James Carter", "Petty Officer 2nd Class"), "Petty Officer 2nd Class James Carter");
  assert.equal(formalName("Robert Ng", "SSgt."), "SSgt. Robert Ng");
});

test("formalName returns the bare name when there is no rank", () => {
  assert.equal(formalName("Joshua L. Holm", ""), "Joshua L. Holm");
  assert.equal(formalName("Joshua L. Holm"), "Joshua L. Holm");
});

test("formalName does not double a rank still embedded in the name", () => {
  assert.equal(formalName("SSgt. Robert Ng", "SSgt."), "SSgt. Robert Ng");
  assert.equal(formalName("Staff Sergeant Robert Ng", "Staff Sergeant"), "Staff Sergeant Robert Ng");
});

test("formalName is empty when there is no name", () => {
  assert.equal(formalName("", "Sgt."), "");
  assert.equal(formalName(undefined, undefined), "");
});

test("firstName still skips the rank if one is left in the name", () => {
  assert.equal(firstName("SSgt. Robert Ng"), "Robert");
});
