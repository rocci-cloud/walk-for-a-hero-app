import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { G, Rect } from "react-native-svg";
import { colors, fonts } from "../theme";
import { initials } from "../lib/data";

/**
 * A hero's photo, or a designed stand-in when there is none: their initials
 * over quiet flag stripes on the brand blue. Every hero added to the site
 * without a photo used to show a flat blue block here (launch audit, 2026-09-28).
 */
export function HeroPhoto({
  uri,
  name,
  style,
  textSize = 40,
  resizeMode = "cover",
}: {
  uri?: string | null;
  name: string;
  style?: ViewStyle | ViewStyle[];
  textSize?: number;
  resizeMode?: "cover" | "contain";
}) {
  if (uri) {
    return (
      <View style={[styles.box, style]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={resizeMode} accessibilityLabel={`Photo of ${name}`} />
      </View>
    );
  }
  return (
    <View style={[styles.box, style]} accessibilityLabel={name}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <G transform="skewX(-28) translate(20 0)">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Rect key={i} x={-40 + i * 34} y={0} width={14} height={100} fill={colors.white} opacity={i % 2 ? 0.04 : 0.09} />
          ))}
        </G>
      </Svg>
      <Text style={[styles.initials, { fontSize: textSize }]} accessible={false}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.blue, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: fonts.story, color: colors.paper, letterSpacing: 1 },
});
