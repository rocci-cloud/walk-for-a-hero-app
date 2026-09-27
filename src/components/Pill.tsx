import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, shadow } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "dark";
  icon?: "play" | "arrow" | "pause" | "stop" | null;
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

/** v3 pill button: primary actions carry a nested icon "button in the button". */
export function Pill({ label, onPress, variant = "primary", icon = null, busy, disabled, style, accessibilityHint }: Props) {
  const primary = variant === "primary";
  const dark = variant === "dark";
  const fg = primary || dark ? colors.white : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary && [styles.primary, shadow.red],
        dark && styles.dark,
        variant === "secondary" && styles.secondary,
        icon ? styles.withIcon : styles.centered,
        (disabled || busy) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
      {busy ? (
        <View style={styles.iconWrap}>
          <ActivityIndicator color={fg} />
        </View>
      ) : icon ? (
        <View style={[styles.iconWrap, !primary && !dark && { backgroundColor: "rgba(17,26,58,0.08)" }]}>
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
  withIcon: { justifyContent: "space-between", paddingLeft: 24, paddingRight: 6 },
  centered: { justifyContent: "center", paddingHorizontal: 20 },
  primary: { backgroundColor: colors.red },
  dark: { backgroundColor: colors.ink },
  secondary: { borderWidth: 1.5, borderColor: colors.ink },
  label: { fontFamily: fonts.heavy, fontSize: 17 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});
