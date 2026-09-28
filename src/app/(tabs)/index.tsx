import { useCallback, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../../auth/AuthContext";
import { useWalkerData } from "../../auth/WalkerData";
import { Pill } from "../../components/Pill";
import { ProgressRing } from "../../components/ProgressRing";
import { Avatar, Card, Header, MileLedger, Notice } from "../../components/ui";
import { MISSION_MILES, SITE_URL, WALK_WINDOW_DAYS } from "../../lib/config";
import { heroSubtitle, initials, money, pledgeSummary, walkWindow } from "../../lib/data";
import { openWalk } from "../../walk/store";
import { colors, fonts, shadow } from "../../theme";

export default function Today() {
  const { state } = useAuth();
  const { walker, hero, backers, loaded, reloadAll } = useWalkerData();
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);
  const [walking, setWalking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const w = openWalk();
      setPending(w?.status === "finishing");
      setWalking(w?.status === "active" || w?.status === "paused");
      reloadAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadAll();
    setRefreshing(false);
  };

  if (state.status !== "signed_in") return null;

  if (!walker) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pad}>
          <Header eyebrow="WALK FOR A HERO" title={state.walkerError === "offline" ? "You're offline" : "Welcome"} />
          <Text style={styles.body}>
            {state.walkerError === "offline"
              ? "We can't reach Walk For A Hero right now. You can still record a walk — it will be sent when you're back online."
              : state.walkerError ||
                `You're signed in as ${state.user.email}, but this account isn't registered as a walker yet. Sign up on walkforahero.com with this same email, then come back here.`}
          </Text>
          {state.walkerError !== "offline" && (
            <>
              <Pill label="Become a walker" icon="arrow" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/become-a-walker`)} style={{ marginTop: 22 }} />
              <Pill label="I've signed up — check again" variant="secondary" onPress={onRefresh} style={{ marginTop: 10 }} />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const miles = walker.miles_walked || 0;
  const goal = walker.goal_miles || MISSION_MILES;
  const win = walkWindow(walker.created_date);
  const p = pledgeSummary(backers, miles);
  const done = miles >= goal;
  const left = Math.max(0, goal - miles);
  const nextMile = Math.min(goal, Math.floor(miles) + 1);
  const pctOfMile = Math.round((miles - Math.floor(miles)) * 100);

  const paceLine = done
    ? "Mission complete. Thank you."
    : win.closed
      ? `Your 30-day window ended ${win.endsOn?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? ""}.`
      : `${(left / Math.max(1, win.daysLeft)).toFixed(1)} mi a day finishes on time · ${win.daysLeft} day${win.daysLeft === 1 ? "" : "s"} left`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Header
          eyebrow={win.closed ? "WALK WINDOW CLOSED" : `DAY ${win.day} OF ${WALK_WINDOW_DAYS}`}
          title="Today"
          right={<Avatar name={initials(walker.name)} photo={walker.photo_url} onPress={() => router.push("/profile")} />}
        />

        {walking && <Notice>You have a walk in progress. Open Walk to see it.</Notice>}
        {pending && <Notice>You have a finished walk waiting to be sent. Open Walk to send it.</Notice>}

        <Card style={{ marginTop: 18 }}>
          <View style={styles.cardRow}>
            <ProgressRing miles={miles} goal={goal} size={160} />
            <View style={{ flex: 1, gap: 10 }}>
              <View>
                <Text style={styles.statLabel}>PLEDGED</Text>
                <Text style={[styles.statBig, { color: colors.red }]} adjustsFontSizeToFit numberOfLines={1}>
                  {money(p.pledgedToCollect)}
                </Text>
              </View>
              <View style={styles.rule} />
              <View>
                <Text style={styles.statLabel}>RAISED</Text>
                <Text style={styles.statBig} adjustsFontSizeToFit numberOfLines={1}>
                  {money(walker.total_raised)}
                </Text>
              </View>
              <Text style={styles.small}>{paceLine}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.ledgerHead}>
          <Text style={styles.ledgerLabel}>MILE LEDGER</Text>
          <Text style={styles.ledgerRight}>{done ? "All 15 miles" : `Mile ${nextMile} · ${pctOfMile}%`}</Text>
        </View>
        <MileLedger miles={miles} goal={goal} />

        {win.closed && !done ? (
          <Notice tone="blue">
            Your 30-day window has ended. You can still walk: miles are counted, and the Foundation takes a quick look at walks logged after day 30.
          </Notice>
        ) : null}
        <Pill
          label={walking ? "Back to your walk" : done ? "Keep walking" : `Walk mile ${nextMile}`}
          icon="play"
          onPress={() => router.navigate("/walk")}
          style={{ marginTop: 18 }}
        />

        {hero ? (
          <Pressable accessibilityRole="button" onPress={() => router.navigate("/hero")} style={[styles.heroCard, shadow.card]}>
            <View style={styles.heroPhotoWrap}>
              {hero.photo_url ? <Image source={{ uri: hero.photo_url }} style={styles.heroPhoto} /> : null}
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroEyebrow}>WALKING FOR</Text>
              <Text style={styles.heroName} numberOfLines={1} adjustsFontSizeToFit>
                {hero.name}
              </Text>
              <Text style={styles.heroSub} numberOfLines={2}>
                {[heroSubtitle(hero), `${p.count} backer${p.count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </Pressable>
        ) : loaded ? (
          <Pressable accessibilityRole="button" onPress={() => router.push("/choose-hero")} style={[styles.heroCard, styles.chooseCard, shadow.card]}>
            <View style={styles.heroText}>
              <Text style={styles.heroEyebrow}>WHO ARE YOU WALKING FOR?</Text>
              <Text style={styles.heroName}>Choose your hero</Text>
              <Text style={styles.heroSub}>Your miles and your backers’ pledges fund one named veteran’s exoskeleton.</Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => router.navigate("/backers")} style={styles.backersRow}>
          <Text style={styles.backersText}>
            {p.count
              ? `${p.count} backer${p.count === 1 ? "" : "s"} · ${money(p.perMile)} per mile`
              : "No backers yet — invite someone to pledge per mile"}
          </Text>
          <Text style={styles.backersLink}>{p.count ? "See backers" : "Invite"}</Text>
        </Pressable>

        <Text style={styles.disclaimer}>“Pledged” is projected from per-mile pledges and isn’t collected yet. “Raised” is money received.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 120 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.secondary, marginTop: 16 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statLabel: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2, color: colors.muted },
  statBig: { fontFamily: fonts.black, fontSize: 26, color: colors.ink, fontVariant: ["tabular-nums"], marginTop: 2 },
  rule: { height: 1, backgroundColor: colors.hairline },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.secondary },
  ledgerHead: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  ledgerLabel: { fontFamily: fonts.heavy, fontSize: 12, letterSpacing: 1, color: colors.secondary },
  ledgerRight: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.secondary },
  heroCard: { marginTop: 16, borderRadius: 26, backgroundColor: colors.ink, flexDirection: "row", overflow: "hidden", minHeight: 96 },
  chooseCard: { backgroundColor: colors.blue },
  heroPhotoWrap: { width: 96, backgroundColor: colors.blue },
  heroPhoto: { width: "100%", height: "100%" },
  heroText: { flex: 1, padding: 16, justifyContent: "center" },
  heroEyebrow: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2.2, color: colors.brass },
  heroName: { fontFamily: fonts.story, fontSize: 24, color: colors.paper, marginTop: 2 },
  heroSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: "rgba(244,238,227,0.72)", marginTop: 3 },
  backersRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingVertical: 6 },
  backersText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.secondary },
  backersLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.blue, textDecorationLine: "underline" },
  disclaimer: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.muted, marginTop: 14 },
});
