import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../../auth/AuthContext";
import { Pill } from "../../components/Pill";
import { ProgressRing } from "../../components/ProgressRing";
import { base44 } from "../../lib/base44";
import { MISSION_MILES, SITE_URL, WALK_WINDOW_DAYS } from "../../lib/config";
import { openWalk } from "../../walk/store";
import { colors, fonts, shadow } from "../../theme";

function daysLeft(createdIso?: string) {
  const start = Date.parse(createdIso || "");
  if (!start) return null;
  const day = Math.floor((Date.now() - start) / 86400000);
  return { day: Math.min(WALK_WINDOW_DAYS, day + 1), left: Math.max(0, WALK_WINDOW_DAYS - day) };
}

const money = (n?: number) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Today() {
  const { state, refresh } = useAuth();
  const [heroName, setHeroName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);

  const walker = state.status === "signed_in" ? state.walker : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ref = walker?.hero_supported_id || "";
      if (!ref) return setHeroName(walker?.hero_supported_name || null);
      // hero_supported_id is a Hero record id on new walkers and a free-text
      // name on older ones (see heroLink on the website). Never show an id.
      const hero: any = await base44.entities.Hero.get(ref).catch(() => null);
      if (!cancelled) setHeroName(hero?.name || walker?.hero_supported_name || (/^[a-f0-9]{24}$/.test(ref) ? null : ref));
    })();
    return () => {
      cancelled = true;
    };
  }, [walker?.hero_supported_id, walker?.hero_supported_name]);

  useFocusEffect(
    useCallback(() => {
      setPending(openWalk()?.status === "finishing");
      refresh().catch(() => {});
    }, [refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  };

  if (state.status !== "signed_in") return null;

  if (!walker) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pad}>
          <Text style={styles.eyebrow}>WALK FOR A HERO</Text>
          <Text style={styles.h1}>{state.walkerError === "offline" ? "You're offline" : "No walker profile yet"}</Text>
          <Text style={styles.body}>
            {state.walkerError === "offline"
              ? "We can't reach Walk For A Hero right now. You can still record a walk — it will be sent when you're back online."
              : state.walkerError ||
                `You're signed in as ${state.user.email}, but this account isn't registered as a walker yet.`}
          </Text>
          {state.walkerError !== "offline" && (
            <Pill label="Become a walker" icon="arrow" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/become-a-walker`)} style={{ marginTop: 22 }} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const miles = walker.miles_walked || 0;
  const goal = walker.goal_miles || MISSION_MILES;
  const win = daysLeft(walker.created_date);
  const nextMile = Math.min(goal, Math.floor(miles) + 1);
  const done = miles >= goal;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Text style={styles.eyebrow}>{win ? `DAY ${win.day} OF ${WALK_WINDOW_DAYS}` : "WALK FOR A HERO"}</Text>
        <Text style={styles.title}>Today</Text>

        {pending && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>You have a finished walk waiting to be sent. Open Walk to send it.</Text>
          </View>
        )}

        <View style={styles.shell}>
          <View style={[styles.core, shadow.card]}>
            <ProgressRing miles={miles} goal={goal} />
            <View style={{ flex: 1, gap: 12 }}>
              <View>
                <Text style={styles.statLabel}>RAISED</Text>
                <Text style={styles.statBig}>{money(walker.total_raised)}</Text>
              </View>
              <View style={styles.rule} />
              <Text style={styles.small}>
                {done
                  ? "Mission complete. Thank you."
                  : win
                  ? `${win.left} day${win.left === 1 ? "" : "s"} left · ${(goal - miles).toFixed(1)} mi to go`
                  : `${(goal - miles).toFixed(1)} mi to go`}
              </Text>
            </View>
          </View>
        </View>

        <Pill
          label={done ? "Keep walking" : `Walk mile ${nextMile}`}
          icon="play"
          onPress={() => router.push("/walk")}
          style={{ marginTop: 18 }}
        />

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>WALKING FOR</Text>
          <Text style={styles.heroName}>{heroName || "Your hero"}</Text>
          <Text style={styles.heroSub}>Your miles and your backers’ pledges fund an FDA-cleared exoskeleton.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 40 },
  eyebrow: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2.2, color: colors.brassText, marginTop: 8 },
  title: { fontFamily: fonts.heavy, fontSize: 28, color: colors.ink, marginTop: 2 },
  h1: { fontFamily: fonts.story, fontSize: 28, color: colors.ink, marginTop: 8 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.secondary, marginTop: 10 },
  notice: { backgroundColor: "rgba(201,160,76,0.18)", borderRadius: 16, padding: 14, marginTop: 14 },
  noticeText: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 14, lineHeight: 20 },
  shell: { marginTop: 16, borderRadius: 32, padding: 6, backgroundColor: "rgba(17,26,58,0.05)" },
  core: { borderRadius: 26, backgroundColor: colors.white, padding: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  statLabel: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.5, color: colors.muted },
  statBig: { fontFamily: fonts.black, fontSize: 24, color: colors.red, fontVariant: ["tabular-nums"] },
  rule: { height: 1, backgroundColor: colors.hairline },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.secondary },
  heroCard: { marginTop: 16, borderRadius: 24, backgroundColor: colors.ink, padding: 18 },
  heroEyebrow: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2, color: colors.brass },
  heroName: { fontFamily: fonts.story, fontSize: 24, color: colors.paper, marginTop: 4 },
  heroSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: "rgba(244,238,227,0.75)", marginTop: 6 },
});
