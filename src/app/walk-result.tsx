import { useMemo } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useWalkerData } from "../auth/WalkerData";
import { Pill } from "../components/Pill";
import { formatElapsed, formatPace } from "../lib/geo";
import { MISSION_MILES } from "../lib/config";
import { backerCurrentCharge, followingThisWalk, inviteTemplates, links, money, pledgeSummary, PROJECTION_NOTE } from "../lib/data";
import { getWalk } from "../walk/store";
import { colors, fonts } from "../theme";

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
  const heroFirst = hero?.name.split(" ")[0] || "your hero";
  const openBackers = followingThisWalk(backers).length;

  const state = r.duplicate
    ? { tone: colors.blue, title: "Already counted", sub: "This walk was sent before and counted once. Nothing was added twice." }
    : r.flagged_for_review
      ? { tone: colors.brass, title: "Walk credited · a reviewer will take a look", sub: "Your miles count now. A person at the Foundation will check this route, and you'll see the outcome on your walkforahero.com dashboard." }
      : r.rejected_miles > 0.005
        ? { tone: colors.brass, title: "Partly counted", sub: `${r.rejected_miles.toFixed(2)} mi moved faster than walking pace, so they weren't counted or charged to backers.` }
        : { tone: "#3F8F4E", title: "Walk credited", sub: "Verified by GPS · on walkforahero.com now" };

  const shareUpdate = () => {
    if (!walker) return;
    const t = inviteTemplates(walker.name, hero?.name || "", links.backWalker(walker)).find((x) => x.id === "milestone")!;
    Share.share({ message: t.text }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.status}>
          <View style={[styles.check, { borderColor: state.tone }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={state.tone} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{state.title}</Text>
            <Text style={styles.statusSub}>{state.sub}</Text>
          </View>
        </View>

        <Text style={styles.miles}>
          {r.distance.toFixed(2)}
          <Text style={styles.milesUnit}> miles</Text>
        </Text>

        <View style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={styles.label}>THIS WALK EARNED</Text>
              <Text style={styles.earned}>{money(earned)}</Text>
              <Text style={styles.small}>
                in pledges from {openBackers} backer{openBackers === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.label}>TOTAL PLEDGED</Text>
              <Text style={styles.total}>{money(total)}</Text>
            </View>
          </View>
          <View style={styles.rule} />
          <View style={{ flexDirection: "row" }}>
            <Stat label="TIME" value={formatElapsed(secs)} />
            <Stat label="PACE" value={pace ? pace.replace(" /mi", "") : "—"} />
            <Stat label="MISSION" value={`${after.toFixed(1)} / ${goal}`} />
          </View>
        </View>
        <Text style={styles.note}>{PROJECTION_NOTE}</Text>

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
        <Pill label="Send an update to backers" variant="light" onPress={shareUpdate} style={{ marginTop: 10 }} />
        <Pill label="Done" variant="light" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </ScrollView>
    </SafeAreaView>
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
  label: { fontFamily: fonts.heavy, fontSize: 10.5, letterSpacing: 1.8, color: colors.brass },
  earned: { fontFamily: fonts.black, fontSize: 32, color: colors.paper, marginTop: 2, fontVariant: ["tabular-nums"] },
  total: { fontFamily: fonts.black, fontSize: 20, color: colors.paper, marginTop: 2, fontVariant: ["tabular-nums"] },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: "rgba(244,238,227,0.7)", marginTop: 2 },
  rule: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 14 },
  statValue: { fontFamily: fonts.heavy, fontSize: 17, color: colors.paper, marginTop: 3, fontVariant: ["tabular-nums"] },
  note: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: "rgba(244,238,227,0.55)", marginTop: 10 },
  quote: { marginTop: 22, borderLeftWidth: 2, borderLeftColor: colors.brass, paddingLeft: 14 },
  quoteText: { fontFamily: fonts.storyItalic, fontSize: 21, lineHeight: 28, color: colors.paper },
});
