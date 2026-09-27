/**
 * Shared GPS/walk math — used by LiveWalkTracker (capture), LiveWalkMap
 * (render), and anywhere else a walk needs to be measured or formatted the
 * same way. Keeping this in one place is what keeps "miles walked" honest
 * across the live tracker, the saved history, and the route map.
 */

/** Great-circle distance between two lat/lng points, in miles. */
export function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  SPEED GOVERNOR — why a mile has to be walked, not driven
 *
 *  Every credited mile bills every one of that walker's backers per mile.
 *  Until now nothing anywhere — client or server — put an upper bound on how
 *  fast a "walk" could move, so a driven route was credited in full and
 *  charged real cards. This is the bound.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * The speed above which movement is not happening on foot.
 *
 * 12 mph is a five-minute mile. The marathon world record averages about
 * 13 mph and is held for two hours by one person on earth. Nobody completing
 * a fifteen-mile charity mission is sustaining either. Every walker and every
 * runner this campaign will ever have sits below this line; every vehicle
 * sits above it.
 *
 * Deliberately NOT set nearer to running pace. A tighter ceiling would start
 * rejecting real segments on ordinary GPS wobble — and a walker robbed of
 * miles they actually walked is a worse failure than a cheat who has to drive
 * at eleven miles an hour for ninety minutes to beat the check. The
 * session-level flagging below is what covers that second case.
 */
export const MAX_ON_FOOT_MPH = 12;

/**
 * Segments shorter than this are not speed-checked.
 *
 * GPS timestamps quantize and fixes arrive in bursts. Across a 0.4-second
 * gap an ordinary two-metre step computes as 11 mph, so speed-checking short
 * intervals rejects honest walking as driving.
 *
 * Distance across these segments is NOT credited on its own — corrected
 * 2026-09-15, and this comment used to say the opposite. Crediting an
 * unjudgeable leg was a complete bypass of the governor (a path with fixes 1
 * second and 0.1 mi apart cleared the noise rule and was credited in full at
 * ~360 mph), so log-walk-miles now holds its anchor across such a leg and
 * folds the displacement into the next leg that IS long enough to judge. See
 * analyzeOnFoot below, which mirrors it exactly.
 */
export const MIN_SPEED_SECONDS = 2;

/** Share of a session's raw distance that can be rejected before a human should look. */
export const REVIEW_REJECT_RATIO = 0.25;
/** ...or this many rejected miles outright, whichever trips first. */
export const REVIEW_REJECT_MILES = 1;

/*
 * ─────────────────────────────────────────────────────────────────────────
 *  GPS FIX QUALITY — 2026-09-13 walk-integrity brief
 *
 *  Two walkers lost almost all their miles to the same cause: the browser
 *  suspends geolocation when the screen locks, and before that even happens
 *  the phone hands over from a coarse cell-tower fix to satellite GPS. The
 *  rules below decide which raw fixes may enter a path at all. They are
 *  capture-time rules, so they live client-side only — log-walk-miles never
 *  sees a fix the client rejected, and it independently re-runs the noise
 *  and speed rules over whatever the client stored.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** metres in a mile — converts accuracy radii and displacements to one unit. */
export const METRES_PER_MILE = 1609.344;

/**
 * A fix whose accuracy radius exceeds this is thrown away outright: not
 * stored in the path, not counted as distance, not evaluated for speed.
 *
 * ── RAISED FROM 30 m TO 70 m (2026-09-17) ──
 * 30 m was a hard reject, and on real phones that is not a rare state:
 * indoors, in an urban canyon, under tree cover, or with iOS "Precise
 * Location" switched off, reported accuracy sits at 40–3000 m for minutes at
 * a time. A walker in that state recorded NOTHING — no path point was ever
 * stored, so lastAcceptedAt stayed null, the gap watchdog never fired,
 * gap_seconds_total stayed 0, the map sat on "Waiting for your first GPS
 * fix…" for the whole walk, and at Finish the session was silently discarded
 * for miles <= 0. Fifteen real miles, and the app said nothing at all.
 *
 * The real filter was never this number: it is legIsNoise() below, which
 * requires a leg's displacement to exceed the COMBINED accuracy radius of
 * its two endpoints. At 60 m accuracy that demands 120 m of movement before
 * a foot of distance is credited, so a coarse fix costs precision, not
 * honesty. Let the noise rule do the work instead of discarding the walk.
 */
export const MAX_FIX_ACCURACY_M = 70;

/**
 * PROGRESSIVE CEILING (2026-09-17). Same spirit as the warm-up below,
 * pointing the other way: if NOTHING has been accepted for a while, the
 * phone is already giving us the best it has, and refusing all of it records
 * nothing. After each ACCURACY_RELAX_AFTER_MS of drought the ceiling widens
 * one step, up to MAX_FIX_ACCURACY_RELAXED_M. It snaps straight back to
 * MAX_FIX_ACCURACY_M as soon as one fix is accepted, so a walk with signal is
 * never measured loosely.
 *
 * The cap is deliberate: past ~150 m the noise rule needs 300 m of
 * displacement per credited leg, which is no longer a route worth drawing.
 */
export const ACCURACY_RELAX_AFTER_MS = 45000;
export const ACCURACY_RELAX_STEP_M = 25;
export const MAX_FIX_ACCURACY_RELAXED_M = 150;

/** The accuracy ceiling in force after `msSinceAccepted` with nothing accepted. */
export function relaxedAccuracyCeiling(msSinceAccepted) {
  if (!Number.isFinite(msSinceAccepted) || msSinceAccepted < ACCURACY_RELAX_AFTER_MS) {
    return MAX_FIX_ACCURACY_M;
  }
  const steps = Math.floor(msSinceAccepted / ACCURACY_RELAX_AFTER_MS);
  return Math.min(MAX_FIX_ACCURACY_RELAXED_M, MAX_FIX_ACCURACY_M + steps * ACCURACY_RELAX_STEP_M);
}

/**
 * GPS WARM-UP. When a walk starts (or resumes) the phone first reports a
 * coarse cell-tower fix, then snaps to satellites. That handover registers
 * as a ~60 metre jump in ~2 seconds and used to get the walker's very first
 * leg marked fast=true — costing them the opening of every walk.
 *
 * So fixes are discarded until EITHER the accuracy drops below this value
 * (a real satellite lock) OR WARMUP_MAX_WAIT_MS has elapsed since the
 * watch started, whichever comes first. The first fix accepted after the
 * warm-up is the route origin.
 */
export const WARMUP_ACCURACY_M = 25;
export const WARMUP_MAX_WAIT_MS = 8000;

/**
 * May this raw fix enter the path?
 * `warmUpStartedAt` is the timestamp the current GPS watch began (start or
 * resume). During the warm-up window only sub-WARMUP_ACCURACY_M fixes pass;
 * after it, anything at or under the ceiling currently in force does.
 *
 * `lastAcceptedAt` is when a fix was last accepted, and it is what drives the
 * progressive ceiling above — pass it so a walker whose phone can only offer
 * coarse fixes eventually records something instead of nothing. With nothing
 * accepted yet the drought is measured from the watch start, which is
 * precisely the case that used to record a whole walk as zero.
 */
export function fixAcceptable(accuracy, warmUpStartedAt, now = Date.now(), lastAcceptedAt = null) {
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) return false;
  const since = Number.isFinite(lastAcceptedAt) && lastAcceptedAt ? lastAcceptedAt : warmUpStartedAt;
  if (accuracy > relaxedAccuracyCeiling(now - since)) return false;
  return accuracy < WARMUP_ACCURACY_M || now - warmUpStartedAt >= WARMUP_MAX_WAIT_MS;
}

/** The accuracy radius stored on a path point; 0 (exact) when absent. */
export function fixAccuracy(p) {
  return typeof p?.acc === "number" && p.acc >= 0 ? p.acc : 0;
}

/**
 * POSITIONAL NOISE RULE. Before a leg is judged against the speed ceiling,
 * compare its displacement to the combined accuracy radius of its two
 * endpoint fixes: movement smaller than where the phone already admits it
 * might be wrong is noise, not travel. Credit zero distance, do NOT mark it
 * fast, and do NOT count it toward the flagged_for_review ratio — noise is
 * the GPS being honest about its error bars, not the walker cheating.
 *
 * Applied identically in the client (capture + live readout) and in
 * log-walk-miles (the authority) — see analyzeOnFoot.
 */
export function legIsNoise(dMiles, accA, accB) {
  return dMiles * METRES_PER_MILE < fixAccuracy({ acc: accA }) + fixAccuracy({ acc: accB });
}

/**
 * Share of a walk's duration that can be covered by signal-loss gaps before
 * the session is flagged for a human to look at (the walker may have walked
 * miles that were never recorded).
 */
export const REVIEW_GAP_RATIO = 0.25;

/** True when a session's signal-loss time exceeds the review ratio of its duration. */
export function gapExceedsThreshold(gapSecondsTotal, elapsedSeconds) {
  return (
    Number(gapSecondsTotal) > 0 &&
    Number(elapsedSeconds) > 0 &&
    Number(gapSecondsTotal) / Number(elapsedSeconds) >= REVIEW_GAP_RATIO
  );
}

/** The flag_reason text naming the gap time and count. Identical in log-walk-miles. */
export function formatGapReason(gapSecondsTotal, gapCount) {
  const minutes = Math.max(1, Math.round(Number(gapSecondsTotal) / 60));
  const count = Math.max(1, Math.floor(Number(gapCount) || 0));
  return `GPS signal was lost for ${minutes} min across ${count} gap${count === 1 ? "" : "s"} — over ${Math.round(REVIEW_GAP_RATIO * 100)}% of this walk went untracked`;
}

/**
 * Human label for the current fix quality, from the last accepted fix's
 * accuracy radius. 'waiting' before the first accepted fix arrives.
 */
export function gpsFixQuality(accuracy) {
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) return "waiting";
  if (accuracy < 10) return "strong";
  if (accuracy < WARMUP_ACCURACY_M) return "good";
  return "weak";
}

/**
 * Speed in mph implied by travelling between two consecutive fixes.
 *
 * Three distinct answers, and the difference between them matters:
 *   a number   — judge it against MAX_ON_FOOT_MPH
 *   null       — interval too short to measure; credit the distance unjudged
 *   Infinity   — the timestamps are impossible; never credit it
 *
 * That last case is not hypothetical. A path whose timestamps run backwards
 * or repeat produces a non-positive interval, and the first version of this
 * returned null for it — which means "unjudgeable", which means CREDITED. A
 * client sending a driven route with shuffled or duplicated timestamps would
 * have bypassed the governor completely and billed every backer for it. The
 * test harness hit this by accident with a buggy fixture, which is the only
 * reason it was caught before shipping.
 *
 * Out-of-order time is therefore treated as infinitely fast rather than
 * unmeasurable: unverifiable movement earns nothing. A MISSING timestamp is
 * the same hole by a shorter route — strip `t` from every point and there is
 * nothing left to judge — so that answers Infinity too. The client stamps
 * every accepted fix, so a path without times is either corrupt or forged;
 * neither should pay.
 */
export function segmentMph(a, b) {
  const ta = a?.t ? new Date(a.t).getTime() : NaN;
  const tb = b?.t ? new Date(b.t).getTime() : NaN;
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.POSITIVE_INFINITY;
  const dtSeconds = (tb - ta) / 1000;
  if (dtSeconds <= 0) return Number.POSITIVE_INFINITY;
  if (dtSeconds < MIN_SPEED_SECONDS) return null;
  const miles = haversineMiles(a.lat, a.lng, b.lat, b.lng);
  return miles / (dtSeconds / 3600);
}

/**
 * How far a start/resume speed-check exemption may cover, in metres.
 *
 * ── WHY THIS BOUND EXISTS (2026-09-17) ──
 * The exemption below was unbounded, and both of its triggers are
 * client-supplied: index 0 of `path`, and any point carrying `gap: true`.
 * A two-point path fifteen miles apart an hour apart was therefore judged as
 * "the first leg", credited in full, unflagged — and the whole-session pace
 * backstop saw 3.9 mph and passed it. Alternating `gap: true` points extended
 * that to any distance. Non-adversarially, one free vehicle-speed leg was
 * credited after every tunnel and every parking garage.
 *
 * The exemption exists for ONE physical event: the cell-tower→satellite
 * handover, which registers as a jump of tens of metres. 150 m is generous
 * for that and useless for anything else — combined with the corroboration
 * rule below, the most a re-armed exemption can now buy is 150 m per 60 s of
 * recorded silence, which is 5.6 mph. Under the ceiling it was bypassing.
 */
export const MAX_HANDOVER_METRES = 150;

/**
 * Is a point's `gap: true` marker backed up by the path's own clock?
 *
 * `gap` is written by the client and re-arms the speed-check exemption, so on
 * its own it is an assertion a forged path can make as often as it likes. A
 * real signal-loss gap is at least GPS_GAP_THRESHOLD_SECONDS of silence and
 * the timestamps prove it; a marker on a leg shorter than that is ignored and
 * the leg is judged like any other. Unparseable or missing timestamps cannot
 * corroborate anything, so they don't — unverifiable movement earns nothing,
 * which is the same rule segmentMph applies.
 *
 * (GPS_GAP_THRESHOLD_SECONDS is declared further down this file; that is fine,
 * module evaluation completes long before any scan runs.)
 */
export function gapIsCorroborated(prev, cur) {
  if (!cur?.gap) return false;
  const tp = prev?.t ? new Date(prev.t).getTime() : NaN;
  const tc = cur?.t ? new Date(cur.t).getTime() : NaN;
  if (!Number.isFinite(tp) || !Number.isFinite(tc)) return false;
  return (tc - tp) / 1000 >= GPS_GAP_THRESHOLD_SECONDS;
}

/**
 * Classify a raw path into on-foot and too-fast movement.
 *
 * Returns the credited distance, what was thrown away, and a copy of the path
 * with `fast: true` set on each point that ENDS a rejected segment. Marking
 * rather than deleting is deliberate: the rejected fixes stay in the record so
 * the route map can show the break and an admin can see what actually
 * happened, instead of the evidence quietly disappearing.
 *
 * Used by the client for live feedback and re-run by log-walk-miles on the
 * server, which is the only place the result is trusted.
 */
export function analyzeOnFoot(path = []) {
  const points = path.map((p) => ({ ...p, fast: false }));
  let miles = 0;
  let rejectedMiles = 0;
  let rejectedSegments = 0;

  /*
   * ANCHOR-BASED SCAN, 2026-09-13.
   *
   * Distance is measured from the last point we ADVANCED past (the anchor),
   * not blindly from the previous point. The reason is the noise rule: a
   * fix that moved less than the combined accuracy radius is not stored and
   * does not move the anchor, so displacement ACCUMULATES until the walker
   * has genuinely moved beyond the GPS's own error bars. Pairwise judging
   * instead would credit the first micro-jitter past the threshold and then
   * reset the baseline, systematically shaving distance off slow walking.
   *
   * The anchor advances whenever a leg is credited or rejected as speeding,
   * and jumps to each CORROBORATED gap point (a resume re-origins the route
   * there) — see gapIsCorroborated above for why a bare `gap` flag is not
   * enough on its own.
   *
   * skipSpeed: the first accepted leg after a start (and the first after a
   * resume, where the anchor is a gap point) is not evaluated against the
   * speed ceiling PROVIDED it is shorter than MAX_HANDOVER_METRES. This is
   * the cell-tower→satellite handover case — a ~60 m jump in ~2 s at the top
   * of a walk is GPS convergence, not a vehicle. Anything longer than a
   * handover is not a handover, so it is judged normally: the exemption used
   * to carry no length bound at all, which made it the widest hole in the
   * governor. Either way the noise rule still applies.
   */
  let anchor = 0;
  let skipSpeed = true;

  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    if (gapIsCorroborated(points[i - 1], cur)) {
      anchor = i; // signal-loss break: never bridged, never judged; re-origin here
      skipSpeed = true;
      continue;
    }
    const a = points[anchor];
    if (typeof a?.lat !== "number" || typeof a?.lng !== "number") {
      // Can't measure from an invalid anchor — re-origin at the current point.
      anchor = i;
      skipSpeed = false;
      continue;
    }
    if (typeof cur?.lat !== "number" || typeof cur?.lng !== "number") continue;

    const d = haversineMiles(a.lat, a.lng, cur.lat, cur.lng);

    // Positional noise: credit zero, no fast mark, nothing toward the flag
    // ratio, and the anchor holds so real movement can accumulate.
    if (legIsNoise(d, fixAccuracy(a), fixAccuracy(cur))) continue;

    const mph = segmentMph(a, cur);

    /*
     * UNJUDGEABLE LEG — 2026-09-15. Mirrors log-walk-miles exactly, and
     * mirroring it is the entire point: this function drives what the WALKER
     * SEES on the active walk screen, and that one drives what the WALKER IS
     * PAID FOR. The server stopped crediting legs shorter than
     * MIN_SPEED_SECONDS (it could not speed-check them, and `null` falling
     * through to `miles += d` was a full bypass of the governor). This still
     * credited them, so a walker's live distance read HIGHER than the figure
     * they were credited — which is a support ticket about missing miles, and
     * the walker is right to open it.
     *
     * Hold the anchor instead: credit nothing, advance nothing, so the
     * displacement accumulates until a leg is long enough to judge and the
     * speed check applies to the combined leg. A real walk loses nothing — its
     * distance is simply measured over a slightly longer baseline. Exempt
     * legs stay exempt for the same reason as below (a start/resume
     * cell-tower→satellite handover jump is not a vehicle) — but only while
     * they are short enough to BE a handover, per MAX_HANDOVER_METRES.
     */
    const exempt = skipSpeed && d * METRES_PER_MILE < MAX_HANDOVER_METRES;

    if (!exempt && mph === null) continue;

    if (!exempt && mph !== null && mph > MAX_ON_FOOT_MPH) {
      cur.fast = true;
      rejectedMiles += d;
      rejectedSegments += 1;
    } else {
      miles += d;
    }
    anchor = i;
    skipSpeed = false;
  }

  const rawMiles = miles + rejectedMiles;
  const flagged =
    rejectedMiles >= REVIEW_REJECT_MILES ||
    (rawMiles > 0 && rejectedMiles / rawMiles >= REVIEW_REJECT_RATIO);

  return {
    points,
    miles: Number(miles.toFixed(4)),
    rejectedMiles: Number(rejectedMiles.toFixed(4)),
    rejectedSegments,
    rawMiles: Number(rawMiles.toFixed(4)),
    flagged,
    flagReason: flagged
      ? `${rejectedMiles.toFixed(2)} of ${rawMiles.toFixed(2)} raw miles exceeded ${MAX_ON_FOOT_MPH} mph`
      : "",
  };
}

/**
 * Total credited distance in miles along a path of {lat,lng}.
 *
 * This is the number the WALKER SEES: LiveWalkTracker computes its live
 * readout, its WalkSession save, its live_miles snapshot, the Finish
 * confirmation figure and the recovered-walk figure from this one function.
 * So it has to agree with log-walk-miles, which is the number the walker is
 * PAID for.
 *
 * ── IT DID NOT AGREE (2026-09-15) ──
 * This was a pairwise sum that skipped gap- and fast-marked points and
 * applied nothing else. It therefore credited, on screen, two classes of leg
 * the server refuses:
 *   • legs under MIN_SPEED_SECONDS, which cannot be speed-checked at all and
 *     were a full bypass of the governor until the server stopped crediting
 *     them; and
 *   • positional noise — movement smaller than the combined accuracy radius of
 *     its own endpoints, which is the GPS admitting it might be wrong rather
 *     than the walker moving.
 * Both inflate the live figure, so a walker watched 15.00 on screen and was
 * credited less, with nothing on the page explaining the gap.
 *
 * ── AND IT STILL DID NOT AGREE ON THE FIRST LEG AFTER A GAP (2026-09-17) ──
 * This function also carried a `!cur.fast` clause, honouring `fast` marks
 * written at capture time. Capture only re-armed its first-leg exemption in
 * startWatch, so a WATCHDOG-detected gap (which does not restart the watch)
 * left the first post-gap leg speed-judged on the phone and sometimes stored
 * `fast: true`. analyzeOnFoot — on the server, the authority — wipes every
 * `fast` mark before scanning and re-arms the exemption at the gap point, so
 * it CREDITED the same leg. The screen said "0.11 mi … wasn't counted" while
 * the server billed the backers for it, and the stored marks changed under the
 * walker at finish so the route map drew different breaks before and after
 * Finish. The clause is gone: display and credit now run the identical scan
 * over identical input, and a stored `fast` mark is evidence for the map and
 * the audit trail, never an input to either distance figure.
 *
 * It now runs the same anchor-based scan as analyzeOnFoot() above and
 * log-walk-miles' copy of it: identical rules, identical order, identical
 * constants. Written out inline rather than delegating to analyzeOnFoot
 * because that function copies every point to attach `fast` marks, and this
 * is called on every render and every accepted fix — on a four-hour walk that
 * is thousands of allocations a second on a phone that is also holding a GPS
 * watch and a wake lock. If you change a rule in analyzeOnFoot, change it
 * here too.
 */
export function pathDistanceMiles(path = []) {
  let total = 0;
  let anchor = 0;
  let skipSpeed = true;

  for (let i = 1; i < path.length; i++) {
    const cur = path[i];
    if (gapIsCorroborated(path[i - 1], cur)) {
      anchor = i; // signal-loss break: never bridged, never judged; re-origin here
      skipSpeed = true;
      continue;
    }
    const a = path[anchor];
    if (typeof a?.lat !== "number" || typeof a?.lng !== "number") {
      anchor = i;
      skipSpeed = false;
      continue;
    }
    if (typeof cur?.lat !== "number" || typeof cur?.lng !== "number") continue;

    const d = haversineMiles(a.lat, a.lng, cur.lat, cur.lng);

    // Positional noise: credit zero and HOLD the anchor, so real movement
    // accumulates past the GPS's own error bars instead of being shaved off.
    if (legIsNoise(d, fixAccuracy(a), fixAccuracy(cur))) continue;

    const mph = segmentMph(a, cur);

    // The start/resume handover exemption, bounded to MAX_HANDOVER_METRES
    // exactly as analyzeOnFoot bounds it.
    const exempt = skipSpeed && d * METRES_PER_MILE < MAX_HANDOVER_METRES;

    // Too short to judge: hold the anchor and fold this displacement into the
    // next leg that can be judged. Never credited on its own.
    if (!exempt && mph === null) continue;

    // Only this scan's own verdict decides. A stored `fast` mark is NOT read
    // here — see the note above; honouring it is what made the screen and the
    // server disagree on the first leg after a watchdog-detected gap.
    if (!(!exempt && mph !== null && mph > MAX_ON_FOOT_MPH)) {
      total += d;
    }
    anchor = i;
    skipSpeed = false;
  }

  return total;
}

/** Splits a flat path into drawable segments, breaking at each gap-marked point. */
export function pathToSegments(path = []) {
  const segments = [];
  let current = [];
  for (const p of path) {
    // A fast-marked point breaks the drawn line for the same reason a gap
    // does: the route did not continue on foot from the previous fix, so
    // joining them would draw a walk that never happened.
    if ((p.gap || p.fast) && current.length) {
      segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) segments.push(current);
  return segments;
}

/*
 * How many seconds should elapse with no accepted GPS fix before we treat it
 * as a signal-loss gap. 60s per the 2026-09-13 brief: the walker gets a live
 * warning that signal is lost and those minutes are not counting, and the
 * same threshold marks the route break and starts gap-time accounting
 * (WalkSession.gap_seconds_total / gap_count).
 */
export const GPS_GAP_THRESHOLD_SECONDS = 60;

export function formatElapsed(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Pace as MM:SS per mile. Returns null when there isn't enough distance yet to be meaningful. */
export function formatPace(miles, seconds) {
  if (!miles || miles < 0.05 || !seconds) return null;
  const secPerMile = seconds / miles;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}