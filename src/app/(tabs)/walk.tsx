import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../../auth/AuthContext";
import { useWalkerData } from "../../auth/WalkerData";
import { Pill } from "../../components/Pill";
import { WalkMap } from "../../components/WalkMap";
import { analyzeOnFoot, formatElapsed, formatPace } from "../../lib/geo";
import { backerCurrentCharge, money } from "../../lib/data";
import { MISSION_MILES } from "../../lib/config";
import { onWalkUpdated } from "../../walk/locationTask";
import { WalkError, finishWalk, openSettings, pauseWalk, resumeWalk, sendWalk, startWalk, type SendOutcome } from "../../walk/controller";
import { discardWalk, getPoints, openWalk, recentDone, walkingSeconds, type WalkRow } from "../../walk/store";
import type { PathPoint } from "../../walk/capture";
import { colors, fonts, shadow } from "../../theme";

/**
 * The walk (v3 "Walking · night map"). Recording happens in the background
 * task (walk/locationTask.ts); this screen only reads what has been stored and
 * offers the controls, so leaving it, locking the phone or switching apps
 * never stops a walk.
 */
export default function WalkScreen() {
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const { walker, hero, backers, reloadAll } = useWalkerData();
  const [walk, setWalk] = useState<WalkRow | null>(null);
  const [points, setPoints] = useState<PathPoint[]>([]);
  const [recent, setRecent] = useState<WalkRow[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ message: string; settings?: boolean } | null>(null);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const [holdHint, setHoldHint] = useState(false);
  const [needsAlways, setNeedsAlways] = useState(false);

  const reload = useCallback(() => {
    const w = openWalk();
    setWalk(w);
    setPoints(w ? getPoints(w.id) : []);
    if (!w) setRecent(recentDone(3));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      Location.getBackgroundPermissionsAsync()
        .then((p) => setNeedsAlways(p.status !== "granted"))
        .catch(() => {});
      const off = onWalkUpdated(reload);
      const tick = setInterval(() => {
        setNow(Date.now());
        reload(); // background fixes land without an event when the JS side was asleep
      }, 2000);
      return () => {
        off();
        clearInterval(tick);
      };
    }, [reload]),
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Live miles use the SAME analysis the server runs at Finish, so the number
  // on screen is the number that will be credited (the server has the last word).
  const live = useMemo(() => analyzeOnFoot(points), [points]);
  const seconds = walk ? walkingSeconds(walk, now) : 0;
  const pace = formatPace(live.miles, seconds);
  const lastAcc = points.length ? points[points.length - 1].acc : null;

  const before = walker?.miles_walked || 0;
  const goal = walker?.goal_miles || MISSION_MILES;
  const pledgedThisWalk = backers
    .filter((b) => !b.collected)
    .reduce((s, b) => s + backerCurrentCharge(b, before + live.miles) - backerCurrentCharge(b, before), 0);

  const guard = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof WalkError) setProblem({ message: e.message, settings: e.action === "settings" });
      else setProblem({ message: "Something went wrong. Your walk is still saved on your phone." });
    } finally {
      setBusy(null);
      reload();
    }
  };

  const onStart = () =>
    guard("start", async () => {
      setOutcome(null);
      const email = state.status === "signed_in" ? state.user.email : "";
      await startWalk(email);
      setNeedsAlways(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });

  const onPause = () => walk && guard("pause", () => pauseWalk(walk.id));
  const onResume = () => walk && guard("resume", () => resumeWalk(walk.id));

  const doFinish = () =>
    walk &&
    guard("finish", async () => {
      const id = walk.id;
      const out = await finishWalk(id);
      setOutcome(out);
      if (out.kind === "done") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        reloadAll();
        router.push({ pathname: "/walk-result", params: { id } });
      }
    });

  const onRetry = () =>
    walk &&
    guard("send", async () => {
      const id = walk.id;
      const out = await sendWalk(id);
      setOutcome(out);
      if (out.kind === "done") {
        reloadAll();
        router.push({ pathname: "/walk-result", params: { id } });
      }
    });

  const onDiscard = () => {
    if (!walk) return;
    discardWalk(walk.id);
    setOutcome(null);
    reload();
  };

  const status = walk?.status ?? "idle";
  const recording = status === "active";
  const walkingNow = status === "active" || status === "paused";

  return (
    <View style={styles.root}>
      <WalkMap points={points} following={status !== "finishing"} bottomInset={status === "idle" ? 300 : 400} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.chip}>
          <View style={[styles.dot, { backgroundColor: recording ? colors.redBright : status === "paused" ? colors.brass : colors.muted }]} />
          <Text style={styles.chipText}>
            {status === "active" ? "Recording" : status === "paused" ? "Paused" : status === "finishing" ? "Not sent yet" : "Ready"}
          </Text>
        </View>
        {hero ? (
          <View style={styles.chip}>
            {hero.photo_url ? <Image source={{ uri: hero.photo_url }} style={styles.chipPhoto} /> : null}
            <Text style={styles.chipText}>For {hero.name.split(" ")[0]}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.sheet, shadow.card, { paddingBottom: 96 + Math.max(insets.bottom, 10) }]}>
        <View style={styles.grabber} />

        {status === "idle" ? (
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <Text style={styles.readyTitle}>Ready to walk</Text>
            <InfoRow
              icon="star"
              title={hero ? `Walking for ${hero.name}` : "Walking for your hero"}
              sub={`${Math.max(0, goal - before).toFixed(1)} miles to go · ${backers.length} backer${backers.length === 1 ? "" : "s"} following`}
            />
            {needsAlways ? (
              <InfoRow
                icon="pin"
                title={Platform.OS === "ios" ? "Next, allow location “Always”" : "Next, allow location “All the time”"}
                sub="So your miles keep counting with the screen locked. Location is only used between Start and Finish, and your route stays private."
              />
            ) : (
              <InfoRow icon="lock" title="Lock your phone and pocket it" sub="Tracking keeps running with the screen off. Your route stays private." />
            )}
            {problem && <Problem problem={problem} />}
            <Pill
              label={needsAlways ? "Allow location & start" : "Start walk"}
              icon="play"
              busy={busy === "start"}
              onPress={onStart}
              style={{ marginTop: 14 }}
            />
            {recent.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.label}>RECENT WALKS</Text>
                {recent.map((r) => (
                  <Pressable
                    key={r.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/replay", params: { id: r.id } })}
                    style={styles.recent}
                  >
                    <Text style={styles.recentText}>
                      {new Date(r.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                      {(r.result?.distance ?? 0).toFixed(2)} mi
                    </Text>
                    <Text style={styles.recentLink}>Replay</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        ) : (
          <>
            <View style={styles.headRow}>
              <View>
                <Text style={styles.label}>THIS WALK</Text>
                <Text style={styles.miles} accessibilityLabel={`${live.miles.toFixed(2)} miles this walk`}>
                  {live.miles.toFixed(2)}
                  <Text style={styles.milesUnit}> mi</Text>
                </Text>
              </View>
              {backers.length > 0 && (
                <View style={{ alignItems: "flex-end", paddingBottom: 10 }}>
                  <Text style={styles.plus}>+{money(pledgedThisWalk)}</Text>
                  <Text style={styles.plusSub}>pledged this walk</Text>
                </View>
              )}
            </View>

            <MissionBar before={before} now={live.miles} goal={goal} />
            <View style={styles.missionRow}>
              <Text style={styles.missionText}>
                Mission {(before + live.miles).toFixed(1)} of {goal}
              </Text>
              <Text style={styles.missionText}>{Math.max(0, goal - before - live.miles).toFixed(1)} to go</Text>
            </View>

            <View style={styles.tiles}>
              <Tile label="TIME" value={formatElapsed(seconds)} />
              <Tile label="PACE" value={pace ? pace.replace(" /mi", "") : "—"} />
              <Tile label="GPS" value={lastAcc != null ? `±${Math.round(lastAcc)} m` : "…"} />
            </View>

            {walk && walk.capture.gapCount > 0 && status !== "finishing" ? (
              <Text style={styles.note}>
                Signal dropped {walk.capture.gapCount} time{walk.capture.gapCount === 1 ? "" : "s"}. Miles only count where your phone could see you.
              </Text>
            ) : null}
            {problem && <Problem problem={problem} />}

            {walkingNow && (
              <>
                <View style={styles.row}>
                  {status === "active" ? (
                    <Pill label="Pause" variant="secondary" icon="pause" busy={busy === "pause"} onPress={onPause} style={{ flex: 1 }} />
                  ) : (
                    <Pill label="Resume" variant="secondary" icon="play" busy={busy === "resume"} onPress={onResume} style={{ flex: 1 }} />
                  )}
                  <HoldToFinish busy={busy === "finish"} onDone={doFinish} onTap={() => setHoldHint(true)} />
                </View>
                {holdHint && <Text style={styles.hint}>Press and hold Finish to end your walk.</Text>}
              </>
            )}

            {status === "finishing" && (
              <>
                <Text style={styles.note}>
                  {outcome && outcome.kind !== "done" && "message" in outcome
                    ? outcome.message
                    : outcome?.kind === "nothing_recorded"
                      ? "No route was recorded on this walk, so there are no miles to send."
                      : walk?.last_error || "This walk hasn't reached Walk For A Hero yet. It's saved on your phone."}
                </Text>
                <View style={styles.row}>
                  <ConfirmDelete onConfirm={onDiscard} />
                  {outcome?.kind !== "nothing_recorded" && (
                    <Pill label="Send now" icon="arrow" busy={busy === "send"} onPress={onRetry} style={{ flex: 1 }} />
                  )}
                </View>
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function MissionBar({ before, now, goal }: { before: number; now: number; goal: number }) {
  return (
    <View style={styles.bar} accessibilityLabel={`${(before + now).toFixed(1)} of ${goal} mission miles`}>
      {Array.from({ length: goal }, (_, i) => {
        const done = Math.max(0, Math.min(1, before - i));
        const walkedNow = Math.max(0, Math.min(1 - done, before + now - i - done));
        const last = i === goal - 1;
        return (
          <View key={i} style={[styles.seg, { backgroundColor: last ? "rgba(201,160,76,0.35)" : colors.paperDeep }]}>
            {done > 0 && <View style={{ width: `${done * 100}%`, backgroundColor: colors.blue }} />}
            {walkedNow > 0 && <View style={{ width: `${walkedNow * 100}%`, backgroundColor: colors.red }} />}
          </View>
        );
      })}
    </View>
  );
}

/** Finish needs a deliberate press-and-hold (about a second) so a pocket tap can't end a walk. */
function HoldToFinish({ busy, onDone, onTap }: { busy: boolean; onDone: () => void; onTap: () => void }) {
  const held = useRef(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Finish walk"
      accessibilityHint="Press and hold to finish and send your walk"
      disabled={busy}
      delayLongPress={900}
      onPressIn={() => (held.current = false)}
      onLongPress={() => {
        held.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        onDone();
      }}
      onPress={() => !held.current && onTap()}
      style={({ pressed }) => [styles.finish, shadow.red, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, busy && { opacity: 0.6 }]}
    >
      <Text style={styles.finishText}>{busy ? "Sending…" : "Finish"}</Text>
      {!busy && <Text style={styles.finishSub}>Press and hold</Text>}
    </Pressable>
  );
}

function ConfirmDelete({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Pill
      label={armed ? "Tap again to delete" : "Delete"}
      variant="secondary"
      onPress={() => (armed ? onConfirm() : setArmed(true))}
      style={{ flex: 1 }}
      accessibilityHint="This walk hasn't been counted. Deleting removes its route and miles from your phone."
    />
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function InfoRow({ icon, title, sub }: { icon: "star" | "lock" | "info" | "pin"; title: string; sub: string }) {
  return (
    <View style={styles.info}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.red} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        {icon === "star" && <Path d="M12 3l2.7 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.6l-5.5 3 1.2-6.1-4.5-4.2 6.1-.7z" />}
        {icon === "lock" && <Path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3" />}
        {icon === "info" && <Path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 7.5v.5" />}
        {icon === "pin" && <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 100-4.6 2.3 2.3 0 000 4.6z" />}
      </Svg>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoSub}>{sub}</Text>
      </View>
    </View>
  );
}

function Problem({ problem }: { problem: { message: string; settings?: boolean } }) {
  return (
    <View style={styles.problem}>
      <Text accessibilityRole="alert" style={styles.problemText}>
        {problem.message}
      </Text>
      {problem.settings && (
        <Pressable onPress={openSettings} style={{ paddingTop: 8 }}>
          <Text style={styles.link}>Open Settings</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(11,16,36,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipPhoto: { width: 24, height: 24, borderRadius: 12 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  chipText: { fontFamily: fonts.heavy, color: colors.paper, fontSize: 14 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(17,26,58,0.15)", marginBottom: 12 },
  readyTitle: { fontFamily: fonts.black, fontSize: 26, color: colors.ink, marginBottom: 6 },
  info: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  infoTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  infoSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 1 },
  label: { fontFamily: fonts.heavy, fontSize: 11.5, letterSpacing: 2.4, color: colors.brassText },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  miles: { fontFamily: fonts.black, fontSize: 64, lineHeight: 70, color: colors.ink, fontVariant: ["tabular-nums"] },
  milesUnit: { fontFamily: fonts.bold, fontSize: 20, color: colors.secondary },
  plus: { fontFamily: fonts.black, fontSize: 24, color: colors.red, fontVariant: ["tabular-nums"] },
  plusSub: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  bar: { flexDirection: "row", gap: 3, marginTop: 10 },
  seg: { flex: 1, height: 12, borderRadius: 3, overflow: "hidden", flexDirection: "row" },
  missionRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  missionText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary },
  tiles: { flexDirection: "row", gap: 8, marginTop: 14 },
  tile: { flex: 1, backgroundColor: colors.white, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  tileLabel: { fontFamily: fonts.heavy, fontSize: 10.5, letterSpacing: 1.8, color: colors.muted },
  tileValue: { fontFamily: fonts.black, fontSize: 19, color: colors.ink, marginTop: 2, fontVariant: ["tabular-nums"] },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary, marginTop: 12 },
  hint: { fontFamily: fonts.semibold, fontSize: 13, color: colors.red, marginTop: 8, textAlign: "center" },
  problem: { backgroundColor: "rgba(200,32,42,0.08)", borderRadius: 14, padding: 12, marginTop: 12 },
  problemText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
  link: { fontFamily: fonts.bold, color: colors.blue, textDecorationLine: "underline" },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  finish: { flex: 1, minHeight: 56, borderRadius: 999, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" },
  finishText: { fontFamily: fonts.heavy, fontSize: 17, color: colors.white },
  finishSub: { fontFamily: fonts.semibold, fontSize: 11, color: "rgba(255,255,255,0.85)" },
  recent: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  recentText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  recentLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.blue },
});
