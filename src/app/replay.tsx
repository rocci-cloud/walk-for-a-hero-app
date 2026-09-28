import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useWalkerData } from "../auth/WalkerData";
import { Pill } from "../components/Pill";
import { WalkMap } from "../components/WalkMap";
import { formatElapsed, formatPace } from "../lib/geo";
import { MISSION_MILES } from "../lib/config";
import { backerCurrentCharge, money } from "../lib/data";
import { formatSplit, mileSplits } from "../walk/splits";
import { getPoints, getWalk } from "../walk/store";
import { colors, fonts, shadow } from "../theme";

const SPLIT_COLORS = [colors.brass, "#D97A3E", "#E0513A", colors.redBright];

/** v3 "Replay & mile splits": the credited route on the night map, what it earned, and each mile's time. */
export default function Replay() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { walker, backers } = useWalkerData();
  const walk = useMemo(() => (id ? getWalk(String(id)) : null), [id]);
  const points = useMemo(() => (walk ? getPoints(walk.id) : []), [walk]);
  const r = walk?.result;

  const after = r && typeof r.miles_walked === "number" ? r.miles_walked : walker?.miles_walked || r?.distance || 0;
  const before = Math.max(0, after - (r?.distance || 0));
  const splits = useMemo(() => mileSplits(points, before), [points, before]);
  const earned = backers.filter((b) => !b.collected).reduce((s, b) => s + backerCurrentCharge(b, after) - backerCurrentCharge(b, before), 0);
  const secs = walk ? Math.round(walk.active_ms / 1000) : 0;
  const pace = r ? formatPace(r.distance, secs) : null;
  const fastest = splits.length ? Math.min(...splits.map((s) => s.seconds / s.fraction)) : 1;
  const dayName = walk ? new Date(walk.started_at).toLocaleDateString("en-US", { weekday: "long" }) : "";

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        <WalkMap points={points} following={false} fitRoute bottomInset={20} />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{r?.flagged_for_review ? "WALK CREDITED · UNDER REVIEW" : "WALK CREDITED · VERIFIED BY GPS"}</Text>
          <Text style={styles.title}>
            {dayName}’s {(r?.distance ?? 0).toFixed(2)} miles
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M6 6l12 12M18 6L6 18" stroke={colors.paper} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <ScrollView style={[styles.sheet, shadow.card]} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View>
            <Text style={styles.label}>THIS WALK EARNED</Text>
            <Text style={styles.earned}>{money(earned)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.small}>
              in pledges · {backers.filter((b) => !b.collected).length} backer{backers.length === 1 ? "" : "s"}
            </Text>
            <Text style={styles.mission}>
              {after.toFixed(1)} of {walker?.goal_miles || MISSION_MILES} miles
            </Text>
          </View>
        </View>

        <Text style={[styles.label, { color: colors.muted, marginTop: 18 }]}>MILE SPLITS</Text>
        {splits.length === 0 ? (
          <Text style={styles.small}>Not enough route on this phone to show splits.</Text>
        ) : (
          splits.map((s, i) => {
            const perMile = s.seconds / s.fraction;
            const w = Math.max(0.15, Math.min(1, fastest / perMile));
            return (
              <View key={s.mile} style={styles.split}>
                <Text style={styles.splitMile}>
                  Mile {s.mile}
                  {s.fraction < 0.995 ? <Text style={styles.splitFrac}>{`\n·${s.fraction.toFixed(2).replace(/^0/, "")}`}</Text> : null}
                </Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${w * 100}%`, backgroundColor: SPLIT_COLORS[Math.min(i, SPLIT_COLORS.length - 1)] }]} />
                </View>
                <Text style={styles.splitTime}>{formatSplit(s.seconds, s.fraction)}</Text>
              </View>
            );
          })
        )}
        <Text style={styles.small}>
          Pace per mile. Longer bar = faster. Total {formatElapsed(secs)}
          {pace ? ` · ${pace.replace(" /mi", "")} average` : ""}.
        </Text>

        <Pill
          label="Share route art"
          icon="arrow"
          onPress={() => walk && router.push({ pathname: "/route-art", params: { id: walk.id } })}
          style={{ marginTop: 20 }}
        />
        <Pill label="Done" variant="secondary" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  mapWrap: { height: "52%" },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, gap: 12 },
  eyebrow: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2.2, color: colors.brass },
  title: { fontFamily: fonts.black, fontSize: 24, color: colors.paper, marginTop: 4 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(11,16,36,0.75)", alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, marginTop: -30, backgroundColor: colors.paper, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  label: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2.2, color: colors.brassText },
  earned: { fontFamily: fonts.black, fontSize: 36, color: colors.red, fontVariant: ["tabular-nums"] },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.secondary, marginTop: 6 },
  mission: { fontFamily: fonts.heavy, fontSize: 15, color: colors.ink, marginTop: 2 },
  split: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  splitMile: { width: 64, fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  splitFrac: { fontFamily: fonts.body, fontSize: 12.5, color: colors.secondary },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "rgba(17,26,58,0.07)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  splitTime: { width: 50, textAlign: "right", fontFamily: fonts.heavy, fontSize: 14.5, color: colors.ink, fontVariant: ["tabular-nums"] },
});
