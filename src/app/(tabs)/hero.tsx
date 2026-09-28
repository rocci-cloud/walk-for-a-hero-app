import { useState } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useWalkerData } from "../../auth/WalkerData";
import { Pill } from "../../components/Pill";
import { HeroPhoto } from "../../components/HeroPhoto";
import { Card, emblem } from "../../components/ui";
import { links, money } from "../../lib/data";
import { colors, fonts, shadow } from "../../theme";

/**
 * The walker's hero (v3 "Hero" board). The raised figure is the hero's
 * Stripe-collected total — the same number HeroDetail shows on the website.
 * Give opens walkforahero.com: donations to a 501(c)(3) go through the website
 * (Apple guideline 3.2.2), never an in-app purchase.
 */
export default function HeroTab() {
  const insets = useSafeAreaInsets();
  const { hero, loaded, reloadAll } = useWalkerData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadAll();
    setRefreshing(false);
  };

  if (!hero) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top + 24, paddingHorizontal: 20 }]}>
        <Text style={styles.eyebrow}>YOUR HERO</Text>
        <Text style={styles.name}>{loaded ? "Choose your hero" : " "}</Text>
        {loaded && (
          <>
            <Text style={styles.story}>Every walker is paired with one named veteran. Your miles and your backers’ pledges go to that hero’s exoskeleton package.</Text>
            <Pill label="Choose your hero" icon="arrow" onPress={() => router.push("/choose-hero")} style={{ marginTop: 22 }} />
          </>
        )}
      </View>
    );
  }

  const goal = hero.goal_amount || 150000;
  const raised = hero.raised_amount || 0;
  const pct = Math.max(0, Math.min(1, raised / goal));
  const story = (hero.story || hero.bio || "").trim();

  return (
    <ScrollView
      style={styles.safe}
      contentContainerStyle={{ paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.white} />}
    >
      <View style={[styles.photoWrap, { height: 340 + insets.top }]}>
        <HeroPhoto uri={hero.photo_url} name={hero.name} style={StyleSheet.absoluteFill} textSize={96} />
      </View>

      <View style={styles.sheet}>
        <View style={[styles.emblemWrap, shadow.card]}>
          <Image source={emblem} style={{ width: 78, height: 78 }} />
        </View>
        <Text style={styles.eyebrow}>{hero.is_anchor ? "FOUNDING HERO" : "YOUR HERO"}</Text>
        <Text style={styles.name}>{hero.name}</Text>
        <Text style={styles.sub}>{[hero.conflict, hero.branch].filter(Boolean).join(" · ")}</Text>

        <Card style={{ marginTop: 18 }}>
          <View style={styles.raisedHead}>
            <Text style={styles.raisedLabel}>RAISED FOR {hero.name.split(" ")[0].toUpperCase()}</Text>
            <Text style={styles.raisedOf}>of {money(goal, false)}</Text>
          </View>
          <Text style={styles.raised}>{money(raised, false)}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(pct * 100, raised > 0 ? 2 : 0)}%` }]} />
          </View>
          <Text style={styles.note}>Collected gifts only — the same figure as walkforahero.com.</Text>
        </Card>

        <Pill
          label={`Give to ${hero.name.split(" ")[0]}`}
          icon="arrow"
          onPress={() => WebBrowser.openBrowserAsync(links.giveToHero(hero))}
          style={{ marginTop: 16 }}
        />
        <Text style={styles.fine}>100% of every gift designated to a hero funds that hero’s package. Card processing fees are the one deduction, taken by the processor, not by us. Secure checkout on walkforahero.com.</Text>

        {story ? (
          <>
            <Text style={[styles.eyebrow, { marginTop: 26 }]}>{hero.name.split(" ")[0].toUpperCase()}’S STORY</Text>
            {story.split(/\n\s*\n/).map((para, i) => (
              <Text key={i} style={styles.story}>
                {para.trim()}
              </Text>
            ))}
          </>
        ) : null}

        <Pill label="Full story on walkforahero.com" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(links.heroPage(hero))} style={{ marginTop: 20 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  photoWrap: { backgroundColor: colors.blue, overflow: "hidden" },
  sheet: {
    marginTop: -40,
    backgroundColor: colors.paper,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 20,
    paddingTop: 58,
  },
  emblemWrap: {
    position: "absolute",
    top: -48,
    left: 20,
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2.4, color: colors.brassText },
  name: { fontFamily: fonts.story, fontSize: 38, lineHeight: 44, color: colors.ink, marginTop: 4 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.secondary, marginTop: 4 },
  raisedHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  raisedLabel: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2, color: colors.muted },
  raisedOf: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  raised: { fontFamily: fonts.black, fontSize: 32, color: colors.ink, marginTop: 4, fontVariant: ["tabular-nums"] },
  track: { height: 12, borderRadius: 6, backgroundColor: "rgba(17,26,58,0.07)", marginTop: 10, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 6, backgroundColor: colors.red },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 8 },
  fine: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: "center", marginTop: 10 },
  story: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 24, color: colors.ink, marginTop: 10 },
});
