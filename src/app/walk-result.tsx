import { useEffect, useMemo, useState } from "react";
import { Animated, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useWalkerData } from "../auth/WalkerData";
import { Pill } from "../components/Pill";
import { formatElapsed, formatPace } from "../lib/geo";
import { MISSION_MILES } from "../lib/config";
import {
  backerCurrentCharge,
  firstName,
  followingThisWalk,
  heroFullName,
  inviteTemplates,
  pledgeSummary,
  links,
  money,
  ordinal,
  PROJECTION_NOTE,
  walkNumber,
} from "../lib/data";
import { getWalk } from "../walk/store";
import { colors, fonts, type } from "../theme";
import { CountUp, Rise, StarBurst, curve, prefersReducedMotion, tap } from "../components/motion";
import { emblem } from "../components/ui";

/**
 * What a walker sees after Finish (v2 "Walk credited" + "Every walk outcome"),
 * worded from the server's actual answer: credited, credited-and-flagged,
 * partly counted, or already counted.
 */
export default function WalkResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { walker, hero, backers } = useWalkerData();
  const walk = useMemo(() => (id ? getWalk(String(id)) : null), [id]);
  const r = walk?.result;
  // The 15-mile moment: shown once, full screen, before the numbers.
  const finished = !!r && !!walker && (typeof r.miles_walked === "number" ? r.miles_walked : walker.miles_walked || 0) >= (walker.goal_miles || MISSION_MILES) && r.distance > 0.05 && !r.duplicate;
  const [celebrate, setCelebrate] = useState(finished);

  if (!walk || !r) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pad}>
          <Text style={styles.title}>Walk not found</Text>
          <Pill label="Done" variant="light" onPress={() => router.back()} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  const after = typeof r.miles_walked === "number" ? r.miles_walked : walker?.miles_walked || r.distance;
  const before = Math.max(0, after - r.distance);
  const goal = walker?.goal_miles || MISSION_MILES;
  const earned = followingThisWalk(backers).reduce((s, b) => s + backerCurrentCharge(b, after) - backerCurrentCharge(b, before), 0);
  const total = pledgeSummary(backers, after).pledgedToCollect;
  const secs = Math.round(walk.active_ms / 1000);
  const pace = formatPace(r.distance, secs);
  const left = Math.max(0, goal - after);
  const heroFirst = firstName(hero?.name);
  const openBackers = followingThisWalk(backers).length;

  if (celebrate) {
    return (
      <Celebration
        goal={goal}
        heroName={heroFullName(hero)}
        walkNumber={walkNumber(walker)}
        onDone={() => setCelebrate(false)}
      />
    );
  }


  const state = r.duplicate
    ? { tone: colors.blue, title: "Already counted", sub: "This walk was sent before and counted once. Nothing was added twice." }
    : r.flagged_for_review
      ? { tone: colors.brass, title: "Walk credited · a reviewer will take a look", sub: "Your miles count now. A person at the Foundation will check this route, and you'll see the outcome on your walkforahero.com dashboard." }
      : r.rejected_miles > 0.005
        ? { tone: colors.brass, title: "Partly counted", sub: `${r.rejected_miles.toFixed(2)} mi moved faster than walking pace, so they weren't counted or charged to backers.` }
        : { tone: "#3F8F4E", title: "Walk credited", sub: "Verified by GPS · on walkforahero.com now" };

  const shareUpdate = () => {
    if (!walker) return;
    const t = inviteTemplates(heroFullName(hero), links.backWalker(walker)).find((x) => x.id === "milestone")!;
    Share.share({ message: t.text }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Rise index={0}>
        <View style={styles.status}>
          <Check tone={state.tone} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{state.title}</Text>
            <Text style={styles.statusSub}>{state.sub}</Text>
          </View>
        </View>
        </Rise>

        <Rise index={1}>
        <Text style={styles.miles}>
          <CountUp value={r.distance} format={(n) => n.toFixed(2)} style={styles.miles} />
          <Text style={styles.milesUnit}> miles</Text>
        </Text>
        </Rise>

        <Rise index={2}>
        <View style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={styles.label}>This walk earned</Text>
              <Text style={styles.earned}>{money(earned)}</Text>
              <Text style={styles.small}>
                in pledges from {openBackers} backer{openBackers === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.label}>Total pledged</Text>
              <Text style={styles.total}>{money(total)}</Text>
            </View>
          </View>
          <View style={styles.rule} />
          <View style={{ flexDirection: "row" }}>
            <Stat label="Time" value={formatElapsed(secs)} />
            <Stat label="Pace" value={pace ? pace.replace(" /mi", "") : "—"} />
            <Stat label="Mission" value={`${after.toFixed(1)} / ${goal}`} />
          </View>
        </View>
        <Text style={styles.note}>{PROJECTION_NOTE}</Text>
        </Rise>

        <View style={styles.quote}>
          <Text style={styles.quoteText}>
            {left > 0 ? `${left.toFixed(1)} miles left. Every one of them is for ${heroFirst}.` : `All ${goal} miles done. ${heroFirst} thanks you.`}
          </Text>
        </View>

        {left <= 0 && walker ? (
          <>
            {/* Walk again (2026-09-28): the moment the walk is finished. */}
            <Pill label="Walk again for a hero" icon="arrow" onPress={() => router.replace("/walk-again")} style={{ marginTop: 22 }} />
            <Pill label="See the replay" variant="light" onPress={() => router.replace({ pathname: "/replay", params: { id: walk.id } })} style={{ marginTop: 10 }} />
          </>
        ) : (
          <Pill label="See the replay" icon="play" onPress={() => router.replace({ pathname: "/replay", params: { id: walk.id } })} style={{ marginTop: 22 }} />
        )}
        <View style={styles.quietRow}>
          <Pressable onPress={() => { tap.light(); shareUpdate(); }} hitSlop={8}>
            <Text style={styles.quiet}>Send an update to backers</Text>
          </Pressable>
          <Pressable onPress={() => { tap.light(); router.back(); }} hitSlop={8}>
            <Text style={styles.quiet}>Done</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The check mark draws itself in, with a success tap. */
function Check({ tone }: { tone: string }) {
  const [v] = useState(() => new Animated.Value(prefersReducedMotion() ? 1 : 0));
  useEffect(() => {
    tap.success();
    if (prefersReducedMotion()) return;
    Animated.timing(v, { toValue: 1, duration: 520, delay: 120, easing: curve, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={[styles.check, { borderColor: tone, transform: [{ scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 1.12, 1] }) }] }]}>
      <Animated.View style={{ opacity: v }}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={tone} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The finish moment (design audit, 2026-09-28): the emblem, the miles, the
 * hero's name and a quiet burst of stars. One tap, or four seconds, and the
 * result screen follows with the Walk Again invitation.
 */
function Celebration({ goal, heroName, walkNumber: n, onDone }: { goal: number; heroName: string; walkNumber: number; onDone: () => void }) {
  const [v] = useState(() => new Animated.Value(prefersReducedMotion() ? 1 : 0));
  useEffect(() => {
    tap.success();
    setTimeout(() => tap.heavy(), 350);
    Animated.timing(v, { toValue: 1, duration: 900, easing: curve, useNativeDriver: true }).start();
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [v, onDone]);
  const rise = (from: number) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] });
  return (
    <Pressable style={styles.celebrate} onPress={onDone} accessibilityRole="button" accessibilityLabel="Continue">
      <StarBurst />
      <Animated.View style={[styles.medal, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Image source={emblem} style={{ width: 120, height: 120 }} />
      </Animated.View>
      <Animated.Text style={[styles.celebrateKicker, rise(16)]}>{n > 1 ? `Your ${ordinal(n)} walk` : "Walk complete"}</Animated.Text>
      <Animated.Text style={[styles.celebrateTitle, rise(22)]}>
        {goal} miles{heroName ? ` for ${firstName(heroName)}` : ""}.
      </Animated.Text>
      <Animated.Text style={[styles.celebrateSub, rise(28)]}>Every one of them is on your record. Thank you.</Animated.Text>
      <Animated.Text style={[styles.celebrateHint, { opacity: v }]}>Tap to continue</Animated.Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  pad: { padding: 20, paddingBottom: 40 },
  title: { fontFamily: fonts.black, fontSize: 26, color: colors.paper },
  status: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 8 },
  check: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  statusTitle: { fontFamily: fonts.heavy, fontSize: 16, color: colors.paper },
  statusSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: "rgba(244,238,227,0.7)", marginTop: 1 },
  miles: { fontFamily: fonts.black, fontSize: 84, lineHeight: 92, color: colors.paper, marginTop: 18, fontVariant: ["tabular-nums"] },
  milesUnit: { fontFamily: fonts.bold, fontSize: 22, color: "rgba(244,238,227,0.75)" },
  card: { marginTop: 12, borderRadius: 24, padding: 18, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  label: { ...type.kicker, color: colors.brass },
  earned: { fontFamily: fonts.black, fontSize: 32, color: colors.paper, marginTop: 2, fontVariant: ["tabular-nums"] },
  total: { fontFamily: fonts.black, fontSize: 20, color: colors.paper, marginTop: 2, fontVariant: ["tabular-nums"] },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: "rgba(244,238,227,0.7)", marginTop: 2 },
  rule: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 14 },
  statValue: { fontFamily: fonts.heavy, fontSize: 17, color: colors.paper, marginTop: 3, fontVariant: ["tabular-nums"] },
  note: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: "rgba(244,238,227,0.55)", marginTop: 10 },
  quote: { marginTop: 22, borderLeftWidth: 2, borderLeftColor: colors.brass, paddingLeft: 14 },
  quoteText: { fontFamily: fonts.storyItalic, fontSize: 21, lineHeight: 28, color: colors.paper },
  quietRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, paddingHorizontal: 6 },
  quiet: { ...type.labelSm, color: "rgba(244,238,227,0.8)", textDecorationLine: "underline", paddingVertical: 10 },
  celebrate: { flex: 1, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", padding: 28 },
  medal: { width: 148, height: 148, borderRadius: 74, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.brass },
  celebrateKicker: { ...type.kicker, color: colors.brass, marginTop: 30 },
  celebrateTitle: { ...type.display, fontSize: 40, lineHeight: 46, color: colors.paper, textAlign: "center", marginTop: 8 },
  celebrateSub: { ...type.body, color: "rgba(244,238,227,0.78)", textAlign: "center", marginTop: 12, maxWidth: 300 },
  celebrateHint: { ...type.bodySm, color: "rgba(244,238,227,0.45)", position: "absolute", bottom: 48 },
});
