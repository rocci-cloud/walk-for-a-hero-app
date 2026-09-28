import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { colors, fonts, shadow } from "../theme";

export const emblem = require("../../assets/brand/emblem.png");

/** v3 screen header: emblem, brass eyebrow, big title, optional avatar on the right. */
export function Header({
  eyebrow,
  title,
  right,
  back,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  back?: boolean;
}) {
  return (
    <View style={s.header}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={s.back} hitSlop={8}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M15 5l-7 7 7 7" stroke={colors.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      ) : (
        <Image source={emblem} style={s.emblem} accessibilityIgnoresInvertColors accessible={false} />
      )}
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

/** Double-bezel card: a soft tray with the white card sitting in it. */
export function Card({ children, style, dark }: { children: ReactNode; style?: ViewStyle; dark?: boolean }) {
  return (
    <View style={[s.shell, style]}>
      <View style={[s.core, dark && { backgroundColor: colors.ink }, shadow.card]}>{children}</View>
    </View>
  );
}

export function Eyebrow({ children, color = colors.muted, style }: { children: ReactNode; color?: string; style?: object }) {
  return <Text style={[s.small, { color }, style]}>{children}</Text>;
}

/** 15 squares, one per mile: red = walked, part-filled = in progress, blue star = the finish. */
export function MileLedger({ miles, goal = 15 }: { miles: number; goal?: number }) {
  const cells = Array.from({ length: goal }, (_, i) => Math.max(0, Math.min(1, miles - i)));
  return (
    <View style={s.ledger} accessibilityLabel={`${Math.floor(miles)} of ${goal} miles complete`}>
      {cells.map((f, i) =>
        i === goal - 1 ? (
          <View key={i} style={[s.cell, { backgroundColor: f >= 1 ? colors.red : colors.blue, alignItems: "center", justifyContent: "center" }]}>
            <Svg width={12} height={12} viewBox="0 0 24 24">
              <Path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.4 6.6L12 17l-6 3.4 1.4-6.6-4.9-4.5 6.6-.7z" fill={colors.white} />
            </Svg>
          </View>
        ) : (
          <View key={i} style={[s.cell, { backgroundColor: f >= 1 ? colors.red : colors.paperDeep }]}>
            {f > 0 && f < 1 ? <View style={[s.cellFill, { height: `${f * 100}%` }]} /> : null}
          </View>
        ),
      )}
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
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  emblem: { width: 46, height: 46 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(17,26,58,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2.4, color: colors.brassText },
  title: { fontFamily: fonts.black, fontSize: 28, color: colors.ink, marginTop: 1 },
  avatarRing: { borderWidth: 2, borderColor: colors.red, alignItems: "center", justifyContent: "center" },
  avatar: { backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.heavy, color: colors.white },
  shell: { borderRadius: 32, padding: 6, backgroundColor: "rgba(17,26,58,0.05)" },
  core: { borderRadius: 26, backgroundColor: colors.white, padding: 18 },
  small: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.8 },
  ledger: { flexDirection: "row", gap: 4 },
  cell: { flex: 1, height: 22, borderRadius: 5, overflow: "hidden", justifyContent: "flex-end" },
  cellFill: { backgroundColor: colors.red, width: "100%" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  rowLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 },
  notice: { borderRadius: 16, padding: 14, marginTop: 14 },
  noticeText: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 14, lineHeight: 20 },
});
