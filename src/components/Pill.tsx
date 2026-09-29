import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, pressed as pressedStyle } from "../theme";
import { tap } from "./motion";

type Props = {
  label: string;
  onPress: () => void;
  /**
   * primary   — the ONE action on a screen. Red, with the nested icon.
   * secondary — quiet outline for the second action.
   * text      — a plain link-style action; use for the third and beyond.
   * dark / light — for dark screens.
   */
  variant?: "primary" | "secondary" | "text" | "dark" | "light";
  icon?: "play" | "arrow" | "pause" | "stop" | null;
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
  /** Haptic on press. Primary actions default to a medium tap, the rest light. */
  haptic?: "light" | "medium" | "none";
};

/** v3 pill button. Primary carries the nested icon "button in the button"; no glow (audit 2026-09-28). */
export function Pill({ label, onPress, variant = "primary", icon = null, busy, disabled, style, accessibilityHint, haptic }: Props) {
  const primary = variant === "primary";
  const dark = variant === "dark";
  const light = variant === "light";
  const text = variant === "text";
  const fg = primary || dark || light ? colors.white : text ? colors.blue : colors.ink;
  const feel = haptic ?? (primary ? "medium" : "light");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      onPress={() => {
        if (feel !== "none") (feel === "medium" ? tap.medium : tap.light)();
        onPress();
      }}
      style={({ pressed }) => [
        text ? styles.textBase : styles.base,
        primary && styles.primary,
        dark && styles.dark,
        variant === "secondary" && styles.secondary,
        light && styles.light,
        !text && (icon ? styles.withIcon : styles.centered),
        (disabled || busy) && { opacity: 0.55 },
        pressed && !text && pressedStyle,
        pressed && text && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={[text ? styles.textLabel : styles.label, { color: fg }]}>{label}</Text>
      {busy ? (
        <View style={text ? undefined : styles.iconWrap}>
          <ActivityIndicator color={fg} />
        </View>
      ) : icon && !text ? (
        <View style={[styles.iconWrap, variant === "secondary" && { backgroundColor: "rgba(17,26,58,0.08)" }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            {icon === "play" && <Path d="M8 5.5v13l11-6.5z" fill={fg} />}
            {icon === "arrow" && <Path d="M5 12h14M13 6l6 6-6 6" stroke={fg} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {icon === "pause" && <Path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill={fg} />}
            {icon === "stop" && <Path d="M6.5 6.5h11v11h-11z" fill={fg} />}
          </Svg>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 56, borderRadius: 999, flexDirection: "row", alignItems: "center" },
  textBase: { minHeight: 44, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  withIcon: { justifyContent: "space-between", paddingLeft: 24, paddingRight: 6 },
  centered: { justifyContent: "center", paddingHorizontal: 20 },
  primary: { backgroundColor: colors.red },
  dark: { backgroundColor: colors.ink },
  secondary: { borderWidth: 1.5, borderColor: "rgba(17,26,58,0.28)" },
  light: { borderWidth: 1.5, borderColor: "rgba(244,238,227,0.6)" },
  label: { fontFamily: fonts.bold, fontSize: 16.5 },
  textLabel: { fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: "underline" },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});
