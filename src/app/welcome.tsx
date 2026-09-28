import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { emblem } from "../components/ui";
import { SITE_URL } from "../lib/config";
import { colors, fonts, shadow } from "../theme";

/**
 * Welcome — the first screen a signed-out person sees (Rocci, 2026-09-28).
 *
 * The Foundation leads, not any one hero: heroes are many, and the app is
 * the Foundation's. The top is a night-navy field with a slow-moving flag
 * (stripes and stars drawn in code, no stock imagery), the emblem as a
 * medallion, and a welcome. Below, a paper sheet asks one question —
 * "Where would you like to start?" — and answers it with the five things
 * people come here to do. Everything is plain React Native + SVG, so it
 * ships over the air with no new build.
 */

const open = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

type IconName = "walk" | "join" | "back" | "hero" | "give" | "how";

function Icon({ name, color, size = 26 }: { name: IconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "walk" && (
        <>
          <Circle cx={13.5} cy={4.2} r={1.9} {...p} />
          <Path d="M10.5 21l2-6.2 2.6 2.4V21M8 12.2l2.3-4.3 3.4.5 2.2 3.4 2.6.9M12.8 8.1l-1.6 5.4-3.2 1.9" {...p} />
        </>
      )}
      {name === "join" && (
        <>
          <Circle cx={9.5} cy={8} r={3.4} {...p} />
          <Path d="M3.5 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3M18.5 8.5v5M16 11h5" {...p} />
        </>
      )}
      {name === "back" && <Path d="M12 20.3s-7.8-4.6-7.8-10.4A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.8 2.6c0 5.8-7.8 10.4-7.8 10.4zM9 12h6M12 9.2v5.6" {...p} />}
      {name === "hero" && <Path d="M12 3.2l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.5l-5.3 2.9 1.2-5.9-4.5-4.1 6-.7z" {...p} />}
      {name === "give" && (
        <>
          <Rect x={3.5} y={9} width={17} height={11.5} rx={1.6} {...p} />
          <Path d="M2.8 9h18.4V6.3H2.8zM12 6.3v14.2M12 6.3C10.8 3 7 2.9 7 5c0 1.3 2.3 1.3 5 1.3 2.7 0 5 0 5-1.3 0-2.1-3.8-2-5 1.3z" {...p} />
        </>
      )}
      {name === "how" && (
        <>
          <Circle cx={12} cy={12} r={8.6} {...p} />
          <Path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5z" {...p} />
        </>
      )}
    </Svg>
  );
}

/** The flag field: stripes that drift very slowly, and a canton of stars. */
function FlagField({ width, height, drift }: { width: number; height: number; drift: Animated.Value }) {
  const stripeW = 26;
  const stripes = useMemo(() => Array.from({ length: Math.ceil((width + height) / stripeW) + 6 }, (_, i) => i), [width, height]);
  const stars = useMemo(() => {
    const out: { x: number; y: number; r: number; o: number }[] = [];
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 7; col++) {
        const x = 22 + col * 26 + (row % 2 ? 13 : 0);
        const y = 74 + row * 22;
        out.push({ x, y, r: 1.4 + ((row * 7 + col) % 3) * 0.35, o: 0.18 + ((row + col) % 4) * 0.06 });
      }
    return out;
  }, []);
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -stripeW * 2] });

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
      <Animated.View style={{ position: "absolute", left: -stripeW * 2, top: 0, width: width + stripeW * 6, height, transform: [{ translateX }] }}>
        <Svg width={width + stripeW * 6} height={height}>
          <G transform={`skewX(-28)`}>
            {stripes.map((i) => (
              <Rect key={i} x={i * stripeW * 2} y={0} width={stripeW} height={height} fill={i % 2 ? "#FFFFFF" : colors.red} opacity={i % 2 ? 0.035 : 0.12} />
            ))}
          </G>
        </Svg>
      </Animated.View>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="46%" r="46%">
            <Stop offset="0" stopColor="#2B3FA8" stopOpacity={0.55} />
            <Stop offset="1" stopColor={colors.ink} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="vignette" cx="50%" cy="40%" r="75%">
            <Stop offset="0.55" stopColor={colors.ink} stopOpacity={0} />
            <Stop offset="1" stopColor="#070C1F" stopOpacity={0.85} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#glow)" />
        {stars.map((s, i) => (
          <Path
            key={i}
            d={`M${s.x} ${s.y - s.r * 2.2}l${s.r * 0.65} ${s.r * 1.45} ${s.r * 1.55} .15-1.2 1 .42 1.55-1.37-.85-1.37.85.42-1.55-1.2-1 1.55-.15z`}
            fill="#FFFFFF"
            opacity={s.o}
          />
        ))}
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
      </Svg>
    </View>
  );
}

function Tile({ icon, title, sub, onPress, hint }: { icon: IconName; title: string; sub: string; onPress: () => void; hint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, shadow.card, pressed && styles.pressed]}
    >
      <View style={styles.tileIcon}>
        <Icon name={icon} color={colors.blue} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </Pressable>
  );
}

export default function Welcome() {
  const { width } = useWindowDimensions();
  const heroH = 440;
  const [drift] = useState(() => new Animated.Value(0));
  const [intro] = useState(() => [0, 1, 2, 3].map(() => new Animated.Value(0)));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) {
          intro.forEach((v) => v.setValue(1));
          return;
        }
        Animated.stagger(
          120,
          intro.map((v) => Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true })),
        ).start();
        loop = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
        loop.start();
      });
    return () => loop?.stop();
  }, [drift, intro]);

  const rise = (i: number) => ({
    opacity: intro[i],
    transform: [{ translateY: intro[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
        {/* ── The field ─────────────────────────────────────────────── */}
        <View style={{ height: heroH }}>
          <FlagField width={width} height={heroH} drift={drift} />
          <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
            <View style={styles.topBar}>
              <Text style={styles.wordmark}>WALK FOR A HERO</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push("/sign-in")} style={({ pressed }) => [styles.signIn, pressed && styles.pressed]} hitSlop={8}>
                <Text style={styles.signInText}>Sign in</Text>
              </Pressable>
            </View>

            <View style={styles.center}>
              <Animated.View style={[styles.medalRing, rise(0)]}>
                <View style={styles.medal}>
                  <Image source={emblem} style={styles.medalImg} accessibilityLabel="Walk For A Hero Foundation emblem" />
                </View>
              </Animated.View>
              <Animated.Text style={[styles.welcome, rise(1)]}>WELCOME TO</Animated.Text>
              <Animated.Text style={[styles.title, rise(1)]} accessibilityRole="header">
                Walk For A Hero
              </Animated.Text>
              <Animated.View style={[styles.tricolor, rise(2)]}>
                <View style={[styles.bar, { backgroundColor: colors.red }]} />
                <View style={[styles.bar, { backgroundColor: colors.paper }]} />
                <View style={[styles.bar, { backgroundColor: "#3F5BD8" }]} />
              </Animated.View>
              <Animated.Text style={[styles.lede, rise(2)]}>
                Every mile you walk helps a paralyzed American veteran stand and walk again.
              </Animated.Text>
            </View>
          </SafeAreaView>
        </View>

        {/* ── Where to start ────────────────────────────────────────── */}
        <Animated.View style={[styles.sheet, rise(3)]}>
          <Text style={styles.sheetEyebrow}>WHERE WOULD YOU LIKE TO START?</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start walking. Sign in and log your miles."
            onPress={() => router.push("/sign-in")}
            style={({ pressed }) => [styles.primary, shadow.red, pressed && styles.pressed]}
          >
            <View style={styles.primaryIcon}>
              <Icon name="walk" color={colors.white} size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.primaryTitle}>Start walking</Text>
              <Text style={styles.primarySub}>Sign in and log your miles</Text>
            </View>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M5 12h13M13 6l6 6-6 6" stroke={colors.white} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <View style={styles.grid}>
            <Tile icon="join" title="Become a walker" sub="Join in two minutes" hint="Opens sign-up on walkforahero.com" onPress={() => open("/become-a-walker")} />
            <Tile icon="back" title="Back a walker" sub="Pledge per mile" hint="Opens the walker directory on walkforahero.com" onPress={() => open("/walkers")} />
          </View>
          <View style={styles.grid}>
            <Tile icon="hero" title="Meet our heroes" sub="The veterans we serve" hint="Opens our heroes on walkforahero.com" onPress={() => open("/heroes")} />
            <Tile icon="give" title="Give today" sub="Fund an exoskeleton" hint="Opens secure giving on walkforahero.com" onPress={() => open("/donate")} />
          </View>

          <Text style={[styles.sheetEyebrow, { marginTop: 30 }]}>HOW IT WORKS</Text>
          <View style={[styles.steps, shadow.card]}>
            {[
              ["Walk 15 miles", "At your own pace, tracked by GPS."],
              ["Rally your backers", "Friends and family pledge per mile."],
              ["A veteran stands again", "Pledges fund an FDA-cleared exoskeleton."],
            ].map(([t, s], i) => (
              <View key={t} style={[styles.step, i > 0 && styles.stepRule]}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{t}</Text>
                  <Text style={styles.stepSub}>{s}</Text>
                </View>
              </View>
            ))}
            <Pressable accessibilityRole="link" onPress={() => open("/how-it-works")} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
              <Icon name="how" color={colors.blue} size={18} />
              <Text style={styles.moreText}>The full story on walkforahero.com</Text>
            </Pressable>
          </View>

          <Image source={emblem} style={styles.footMark} accessibilityIgnoresInvertColors accessible={false} />
          <Text style={styles.foot}>WALK FOR A HERO FOUNDATION</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 6 },
  wordmark: { fontFamily: fonts.heavy, fontSize: 12, letterSpacing: 3, color: colors.brass },
  signIn: { borderWidth: 1, borderColor: "rgba(244,238,227,0.45)", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  signInText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.paper },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 34 },
  medalRing: { width: 132, height: 132, borderRadius: 66, borderWidth: 1.5, borderColor: "rgba(201,160,76,0.65)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(201,160,76,0.08)" },
  medal: {
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B3FA8",
    shadowOpacity: 0.7,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  medalImg: { width: 106, height: 106 },
  welcome: { fontFamily: fonts.heavy, fontSize: 12, letterSpacing: 4.2, color: colors.brass, marginTop: 26 },
  title: { fontFamily: fonts.story, fontSize: 44, lineHeight: 50, color: colors.paper, marginTop: 4, textAlign: "center" },
  tricolor: { flexDirection: "row", gap: 6, marginTop: 14 },
  bar: { width: 26, height: 4, borderRadius: 2 },
  lede: { fontFamily: fonts.body, fontSize: 16.5, lineHeight: 24, color: "rgba(244,238,227,0.8)", textAlign: "center", marginTop: 14, maxWidth: 330 },

  sheet: { flexGrow: 1, marginTop: -26, backgroundColor: colors.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 48 },
  sheetEyebrow: { fontFamily: fonts.heavy, fontSize: 11.5, letterSpacing: 2.2, color: colors.muted, marginBottom: 14 },

  primary: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.red, borderRadius: 26, paddingHorizontal: 18, paddingVertical: 18 },
  primaryIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  primaryTitle: { fontFamily: fonts.black, fontSize: 19, color: colors.white },
  primarySub: { fontFamily: fonts.body, fontSize: 13.5, color: "rgba(255,255,255,0.82)", marginTop: 1 },

  grid: { flexDirection: "row", gap: 12, marginTop: 12 },
  tile: { flex: 1, backgroundColor: colors.white, borderRadius: 24, padding: 16, minHeight: 136 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(27,44,143,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  tileTitle: { fontFamily: fonts.heavy, fontSize: 15.5, color: colors.ink },
  tileSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.secondary, marginTop: 3 },

  steps: { backgroundColor: colors.white, borderRadius: 24, paddingHorizontal: 16 },
  step: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15 },
  stepRule: { borderTopWidth: 1, borderTopColor: colors.hairline },
  stepNum: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.brass, textAlign: "center", lineHeight: 27, fontFamily: fonts.heavy, fontSize: 13, color: colors.brassText, overflow: "hidden" },
  stepTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  stepSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.secondary, marginTop: 1 },
  more: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.hairline, paddingVertical: 14 },
  moreText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.blue },

  footMark: { width: 44, height: 44, alignSelf: "center", marginTop: 34, opacity: 0.9 },
  foot: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2.2, color: colors.muted, textAlign: "center", marginTop: 8 },
});
