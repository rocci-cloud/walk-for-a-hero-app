import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../auth/AuthContext";
import { Pill } from "../../components/Pill";
import { WalkMap } from "../../components/WalkMap";
import { analyzeOnFoot, formatElapsed, formatPace } from "../../lib/geo";
import { onWalkUpdated } from "../../walk/locationTask";
import {
  WalkError,
  finishWalk,
  openSettings,
  pauseWalk,
  resumeWalk,
  sendWalk,
  startWalk,
  type SendOutcome,
} from "../../walk/controller";
import { discardWalk, getPoints, openWalk, walkingSeconds, type WalkRow } from "../../walk/store";
import type { PathPoint } from "../../walk/capture";
import { colors, fonts, shadow } from "../../theme";

/**
 * The walk. Recording happens in the background task (walk/locationTask.ts);
 * this screen only reads what has been stored and offers the controls. So
 * leaving this screen, locking the phone or switching apps never stops a walk.
 */
export default function WalkScreen() {
  const { state, refresh } = useAuth();
  const [walk, setWalk] = useState<WalkRow | null>(null);
  const [points, setPoints] = useState<PathPoint[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ message: string; settings?: boolean } | null>(null);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);

  const reload = useCallback(() => {
    const w = openWalk();
    setWalk(w);
    setPoints(w ? getPoints(w.id) : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });

  const onPause = () => walk && guard("pause", () => pauseWalk(walk.id));
  const onResume = () => walk && guard("resume", () => resumeWalk(walk.id));

  const doFinish = () =>
    walk &&
    guard("finish", async () => {
      const out = await finishWalk(walk.id);
      setOutcome(out);
      if (out.kind === "done") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        refresh().catch(() => {});
      }
    });

  const onFinish = () =>
    Alert.alert("Finish this walk?", "Your route will be sent to Walk For A Hero and your miles counted.", [
      { text: "Keep walking", style: "cancel" },
      { text: "Finish", style: "default", onPress: doFinish },
    ]);

  const onRetry = () =>
    walk &&
    guard("send", async () => {
      const out = await sendWalk(walk.id);
      setOutcome(out);
      if (out.kind === "done") refresh().catch(() => {});
    });

  const onDiscard = () =>
    walk &&
    Alert.alert(
      "Throw this walk away?",
      "It hasn't been counted. Its route and miles will be deleted from your phone and can't be recovered.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete walk",
          style: "destructive",
          onPress: () => {
            discardWalk(walk.id);
            setOutcome(null);
            reload();
          },
        },
      ],
    );

  const status = walk?.status ?? "idle";
  const recording = status === "active";

  return (
    <View style={styles.root}>
      <WalkMap points={points} following={recording} />

      <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
        <View style={[styles.chip, recording ? styles.chipLive : styles.chipIdle]}>
          <View style={[styles.dot, { backgroundColor: recording ? colors.redBright : colors.muted }]} />
          <Text style={styles.chipText}>
            {status === "active" ? "Recording" : status === "paused" ? "Paused" : status === "finishing" ? "Not sent yet" : "Ready"}
          </Text>
        </View>
      </SafeAreaView>

      <View style={[styles.sheet, shadow.card]}>
        {outcome?.kind === "done" && status === "idle" ? (
          <DoneCard outcome={outcome} onClose={() => setOutcome(null)} />
        ) : (
          <>
            <View style={styles.stats}>
              <Stat label="MILES" value={live.miles.toFixed(2)} big />
              <Stat label="TIME" value={formatElapsed(seconds)} />
              <Stat label="PACE" value={pace || "—"} />
            </View>

            {walk && walk.capture.gapCount > 0 && status !== "finishing" ? (
              <Text style={styles.note}>
                Signal dropped {walk.capture.gapCount} time{walk.capture.gapCount === 1 ? "" : "s"}. Miles are only counted where your phone could see you.
              </Text>
            ) : null}

            {problem && (
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
            )}

            {status === "idle" && (
              <Pill label="Start walk" icon="play" busy={busy === "start"} onPress={onStart} style={{ marginTop: 14 }} />
            )}

            {(status === "active" || status === "paused") && (
              <View style={styles.row}>
                {status === "active" ? (
                  <Pill label="Pause" variant="secondary" icon="pause" busy={busy === "pause"} onPress={onPause} style={{ flex: 1 }} />
                ) : (
                  <Pill label="Resume" variant="secondary" icon="play" busy={busy === "resume"} onPress={onResume} style={{ flex: 1 }} />
                )}
                <Pill label="Finish" icon="stop" busy={busy === "finish"} onPress={onFinish} style={{ flex: 1 }} />
              </View>
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
                  <Pill label="Delete" variant="secondary" onPress={onDiscard} style={{ flex: 1 }} />
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

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={{ flex: big ? 1.3 : 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, big && styles.statBig]} accessibilityLabel={`${label} ${value}`}>
        {value}
      </Text>
    </View>
  );
}

function DoneCard({ outcome, onClose }: { outcome: Extract<SendOutcome, { kind: "done" }>; onClose: () => void }) {
  const r = outcome.result;
  return (
    <View>
      <Text style={styles.doneEyebrow}>{r.duplicate ? "ALREADY COUNTED" : "WALK COUNTED"}</Text>
      {r.duplicate ? (
        <Text style={styles.doneBody}>This walk was already sent and counted once. Nothing was added twice.</Text>
      ) : (
        <>
          <Text style={styles.doneMiles}>
            {r.distance.toFixed(2)}
            <Text style={styles.doneUnit}> mi</Text>
          </Text>
          {typeof r.miles_walked === "number" && (
            <Text style={styles.doneBody}>{r.miles_walked.toFixed(1)} miles toward your 15.</Text>
          )}
        </>
      )}
      {r.rejected_miles > 0.005 && (
        <Text style={styles.note}>
          {r.rejected_miles.toFixed(2)} mi weren’t counted because they moved faster than a person can walk or run.
        </Text>
      )}
      {r.flagged_for_review && (
        <Text style={styles.note}>
          Our team will take a quick look at this walk. Your miles are counted in the meantime.
        </Text>
      )}
      <Pill label="Done" variant="secondary" onPress={onClose} style={{ marginTop: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chipLive: { backgroundColor: "rgba(17,26,58,0.85)" },
  chipIdle: { backgroundColor: "rgba(17,26,58,0.7)" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.bold, color: colors.paper, fontSize: 13 },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 24,
  },
  stats: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  statLabel: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.4, color: colors.muted },
  statValue: { fontFamily: fonts.heavy, fontSize: 20, color: colors.ink, fontVariant: ["tabular-nums"], marginTop: 2 },
  statBig: { fontFamily: fonts.black, fontSize: 40, lineHeight: 44 },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary, marginTop: 12 },
  problem: { backgroundColor: "rgba(200,32,42,0.08)", borderRadius: 14, padding: 12, marginTop: 12 },
  problemText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
  link: { fontFamily: fonts.bold, color: colors.blue, textDecorationLine: "underline" },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  doneEyebrow: { fontFamily: fonts.heavy, fontSize: 12, letterSpacing: 2, color: colors.brassText },
  doneMiles: { fontFamily: fonts.black, fontSize: 48, color: colors.ink, marginTop: 4 },
  doneUnit: { fontFamily: fonts.bold, fontSize: 20, color: colors.secondary },
  doneBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.secondary, marginTop: 4 },
});
