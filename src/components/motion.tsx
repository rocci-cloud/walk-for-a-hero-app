import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, ease } from "../theme";

/**
 * Motion primitives (design audit, 2026-09-28). All of them respect the
 * phone's Reduce Motion setting, and all run on the native driver except the
 * SVG ring, which cannot.
 */

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotion = v;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
  reduceMotion = v;
});
export const prefersReducedMotion = () => reduceMotion;

export const curve = Easing.bezier(...ease.out);

/* ── Haptics ───────────────────────────────────────────────────────── */

export const tap = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  select: () => Haptics.selectionAsync().catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};

/* ── Rise: the entrance every screen uses ───────────────────────────── */

/** Fades in and rises 14 points, `index` × 70 ms after the screen mounts. */
export function Rise({ children, index = 0, style, distance = 14 }: { children: ReactNode; index?: number; style?: ViewStyle | ViewStyle[]; distance?: number }) {
  const [v] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    const a = Animated.timing(v, { toValue: 1, duration: 620, delay: 40 + index * 70, easing: curve, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, index]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/* ── CountUp: numbers that arrive rather than appear ────────────────── */

export function CountUp({ value, format, style, duration = 900 }: { value: number; format: (n: number) => string; style?: TextStyle | TextStyle[]; duration?: number }) {
  const [animShown, setShown] = useState(0);
  const shown = reduceMotion ? value : animShown;
  const from = useRef(0);
  useEffect(() => {
    if (reduceMotion) return;
    const start = from.current;
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: t }) => setShown(start + (value - start) * t));
    const a = Animated.timing(v, { toValue: 1, duration, easing: curve, useNativeDriver: false });
    a.start(({ finished }) => {
      if (finished) {
        from.current = value;
        setShown(value);
      }
    });
    return () => {
      v.removeListener(id);
      a.stop();
      from.current = value;
    };
  }, [value, duration]);
  return <Text style={style}>{format(shown)}</Text>;
}

/* ── Shimmer: loading that keeps the shape ──────────────────────────── */

export function Shimmer({ width = "100%", height = 16, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.paperDeep, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
        style,
      ]}
    />
  );
}

/* ── Stars: the finish moment ───────────────────────────────────────── */

/** A quiet burst of brass and red stars that rise and fade. Fills its parent. */
export function StarBurst({ count = 18, play = true }: { count?: number; play?: boolean }) {
  const [stars] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      v: new Animated.Value(0),
      x: (i / count) * 100,
      delay: (i * 37) % 500,
      size: 6 + (i % 3) * 4,
      color: i % 4 === 0 ? colors.red : i % 4 === 1 ? colors.paper : colors.brass,
      drift: ((i * 13) % 40) - 20,
    })),
  );
  useEffect(() => {
    if (!play || reduceMotion) return;
    const anims = stars.map((s) => Animated.timing(s.v, { toValue: 1, duration: 1600, delay: s.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [play, stars]);
  if (reduceMotion) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            bottom: "22%",
            fontSize: s.size * 2,
            color: s.color,
            opacity: s.v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.9, 0] }),
            transform: [
              { translateY: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, -260 - s.size * 10] }) },
              { translateX: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, s.drift] }) },
              { rotate: s.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${s.drift * 4}deg`] }) },
            ],
          }}
        >
          ★
        </Animated.Text>
      ))}
    </View>
  );
}
