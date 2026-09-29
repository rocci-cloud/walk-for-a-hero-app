import { useEffect, useState, type ReactNode } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { colors, fonts, radius, shadow, type } from "../theme";
import { curve, prefersReducedMotion, tap } from "./motion";

export const emblem = require("../../assets/brand/emblem.png");

/**
 * v3 screen header: a quiet kicker, the title, an optional back button and
 * an optional control on the right. The emblem no longer repeats on every
 * screen (audit 2026-09-28) — it lives on Welcome, the splash and Profile.
 */
export function Header({
  eyebrow,
  title,
  right,
  back,
  emblem: showEmblem = false,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  back?: boolean;
  emblem?: boolean;
}) {
  return (
    <View style={s.header}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
            tap.light();
            router.back();
          }}
          style={({ pressed }) => [s.back, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M15 5l-7 7 7 7" stroke={colors.ink} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      ) : showEmblem ? (
        <Image source={emblem} style={s.emblem} accessibilityIgnoresInvertColors accessible={false} />
      ) : null}
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text style={s.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function Avatar({ name, photo, size = 52, onPress }: { name: string; photo?: string; size?: number; onPress?: () => void }) {
  const inner = size - 8;
  const body = (
    <View style={[s.avatarRing, { width: size, height: size, borderRadius: size / 2 }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
      ) : (
        <View style={[s.avatar, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Text style={[s.avatarText, { fontSize: inner * 0.34 }]}>{name}</Text>
        </View>
      )}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={onPress} hitSlop={6}>
      {body}
    </Pressable>
  );
}

/** One card surface: white, a hairline, one soft shadow (audit 2026-09-28). */
export function Card({ children, style, dark }: { children: ReactNode; style?: ViewStyle; dark?: boolean }) {
  return <View style={[s.core, dark && { backgroundColor: colors.ink, borderColor: colors.ink }, shadow.card, style]}>{children}</View>;
}

export function Eyebrow({ children, color = colors.muted, style }: { children: ReactNode; color?: string; style?: object }) {
  return <Text style={[s.small, { color }, style]}>{children}</Text>;
}

/**
 * 15 squares, one per mile: red = walked, part-filled = in progress, blue
 * star = the finish. Walked squares fill in one after another on mount.
 */
export function MileLedger({ miles, goal = 15 }: { miles: number; goal?: number }) {
  const cells = Array.from({ length: goal }, (_, i) => Math.max(0, Math.min(1, miles - i)));
  const [anim] = useState(() => cells.map(() => new Animated.Value(prefersReducedMotion() ? 1 : 0)));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const seq = Animated.stagger(
      45,
      anim.map((v) => Animated.timing(v, { toValue: 1, duration: 360, easing: curve, useNativeDriver: true })),
    );
    seq.start();
    return () => seq.stop();
    // Once on mount; the values themselves never change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={s.ledger} accessibilityLabel={`${Math.floor(miles)} of ${goal} miles complete`}>
      {cells.map((f, i) => {
        const walked = f >= 1;
        const scale = walked ? anim[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 1.08, 1] }) : 1;
        return i === goal - 1 ? (
          <Animated.View key={i} style={[s.cell, { backgroundColor: walked ? colors.red : colors.blue, alignItems: "center", justifyContent: "center", transform: [{ scale }] }]}>
            <Svg width={12} height={12} viewBox="0 0 24 24">
              <Path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.4 6.6L12 17l-6 3.4 1.4-6.6-4.9-4.5 6.6-.7z" fill={colors.white} />
            </Svg>
          </Animated.View>
        ) : (
          <Animated.View key={i} style={[s.cell, { backgroundColor: walked ? colors.red : colors.paperDeep, transform: [{ scale }] }]}>
            {f > 0 && f < 1 ? <View style={[s.cellFill, { height: `${f * 100}%` }]} /> : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

export function Row({ label, sub, right, onPress, danger }: { label: string; sub?: string; right?: ReactNode; onPress?: () => void; danger?: boolean }) {
  const body = (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, danger && { color: colors.red }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right ??
        (onPress ? (
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path d="M9 5l7 7-7 7" stroke={colors.muted} strokeWidth={2} fill="none" strokeLinecap="round" />
          </Svg>
        ) : null)}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Notice({ children, tone = "brass" }: { children: ReactNode; tone?: "brass" | "red" | "blue" }) {
  const bg = tone === "red" ? "rgba(200,32,42,0.08)" : tone === "blue" ? "rgba(27,44,143,0.08)" : "rgba(201,160,76,0.18)";
  return (
    <View style={[s.notice, { backgroundColor: bg }]}>
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, minHeight: 52 },
  emblem: { width: 44, height: 44 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(17,26,58,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { ...type.kicker, color: colors.brassText },
  title: { ...type.title, marginTop: 2 },
  avatarRing: { borderWidth: 2, borderColor: colors.red, alignItems: "center", justifyContent: "center" },
  avatar: { backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.heavy, color: colors.white },
  core: { borderRadius: radius.card, backgroundColor: colors.white, padding: 18, borderWidth: 1, borderColor: colors.hairline },
  small: { ...type.kicker },
  ledger: { flexDirection: "row", gap: 4 },
  cell: { flex: 1, height: 22, borderRadius: 5, overflow: "hidden", justifyContent: "flex-end" },
  cellFill: { backgroundColor: colors.red, width: "100%" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  rowLabel: { ...type.label },
  rowSub: { ...type.bodySm, color: colors.muted, marginTop: 1 },
  notice: { borderRadius: 14, padding: 14, marginTop: 14 },
  noticeText: { ...type.bodySm, fontFamily: fonts.semibold, color: colors.ink },
});
