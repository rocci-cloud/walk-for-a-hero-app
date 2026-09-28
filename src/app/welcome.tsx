import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Svg, { Path } from "react-native-svg";
import { Pill } from "../components/Pill";
import { emblem } from "../components/ui";
import { SITE_URL } from "../lib/config";
import { listHeroes, type Hero } from "../lib/data";
import { colors, fonts, shadow } from "../theme";

const logo = require("../../assets/brand/logo.png");

/** v3 Welcome — the first screen a signed-out person sees. */
export default function Welcome() {
  const [hero, setHero] = useState<Hero | null>(null);

  useEffect(() => {
    // Hero records are public (hidden: false), so this works before sign-in.
    listHeroes()
      .then((l) => setHero(l.find((h) => h.is_anchor) || l[0] || null))
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="Walk For A Hero Foundation" />

        <View style={[styles.shell]}>
          <View style={[styles.photo, shadow.card]}>
            {hero?.photo_url ? (
              <Image source={{ uri: hero.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Photo of ${hero.name}`} />
            ) : (
              <Svg width="100%" height="100%" viewBox="0 0 340 300" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
                <Path d="M-20 250 L400 110 M-20 290 L400 150 M-20 210 L400 70" stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={18} />
              </Svg>
            )}
            <View style={styles.badge}>
              <Image source={emblem} style={{ width: 56, height: 56 }} />
            </View>
            {hero ? (
              <View style={styles.caption}>
                <Text style={styles.captionText}>
                  {hero.name}
                  {hero.conflict ? ` · ${hero.conflict}` : ""}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.h1}>Walk 15 miles so a veteran can walk again.</Text>
        <Text style={styles.lede}>Your miles, backed by pledges, fund an FDA-cleared exoskeleton for one named hero.</Text>

        <Pill
          label="Become a walker"
          icon="arrow"
          onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/become-a-walker`)}
          style={{ marginTop: 26 }}
          accessibilityHint="Opens sign-up on walkforahero.com. Then come back and sign in with the same account."
        />
        <Pill label="I already walk · sign in" variant="secondary" onPress={() => router.push("/sign-in")} style={{ marginTop: 10 }} />
        <Text style={styles.fine}>Sign-up takes two minutes on walkforahero.com. Then sign in here with the same account.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 40 },
  logo: { width: 230, height: 108, alignSelf: "center", marginTop: 6 },
  shell: { marginTop: 16, borderRadius: 34, padding: 6, backgroundColor: "rgba(17,26,58,0.06)" },
  photo: { height: 290, borderRadius: 28, backgroundColor: colors.blue, overflow: "hidden" },
  badge: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 999,
    backgroundColor: "rgba(17,26,58,0.62)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  captionText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  h1: { fontFamily: fonts.story, fontSize: 34, lineHeight: 39, color: colors.ink, marginTop: 24 },
  lede: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.secondary, marginTop: 10 },
  fine: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted, textAlign: "center", marginTop: 14 },
});
