import type { TextStyle } from "react-native";

/**
 * v3 palette — taken from the Walk For A Hero emblem (see the design canvas,
 * page "v3 · Color & GPS"). Contrast-checked: muted text on paper is 5.36:1.
 *
 * Color roles (design audit, 2026-09-28): red is the ONE action on a screen
 * and the walked miles; green is money raised; ink is numbers and text; blue
 * is the hero and the brand; brass is milestones and the rare kicker.
 */
export const colors = {
  red: "#C8202A", // flag red: the mission, every primary action
  redBright: "#E23A3A", // route end on the night map
  blue: "#1B2C8F", // royal blue: structure, the star
  brass: "#C9A04C", // milestones, route start
  brassText: "#8A6424", // brass for text on paper
  money: "#2E7D4F", // money raised — green, never red (website rule)
  paper: "#F4EEE3",
  paperDeep: "#E9E1D2",
  ink: "#111A3A", // text, night map
  secondary: "#4A5170",
  muted: "#5B6079",
  white: "#FFFFFF",
  hairline: "rgba(17,26,58,0.10)",
};

export const fonts = {
  body: "Archivo_400Regular",
  semibold: "Archivo_600SemiBold",
  bold: "Archivo_700Bold",
  heavy: "Archivo_800ExtraBold",
  black: "Archivo_900Black",
  story: "Newsreader_500Medium",
  storyItalic: "Newsreader_400Regular_Italic",
};

/**
 * The six type roles (design audit, 2026-09-28). Every Text on every screen
 * uses one of these; a screen never invents its own size.
 */
export const type = {
  /** One per screen: the human headline, in the serif. */
  display: { fontFamily: fonts.story, fontSize: 34, lineHeight: 40, color: colors.ink } as TextStyle,
  /** Screen titles. Bold, not Black. */
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, color: colors.ink, letterSpacing: -0.3 } as TextStyle,
  /** Miles and dollars. */
  figure: { fontFamily: fonts.heavy, fontSize: 40, lineHeight: 44, color: colors.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  figureSm: { fontFamily: fonts.heavy, fontSize: 22, lineHeight: 26, color: colors.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  /** Sentences. */
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.secondary } as TextStyle,
  bodySm: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.secondary } as TextStyle,
  /** Row titles, field labels, tab names. */
  label: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink } as TextStyle,
  labelSm: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.ink } as TextStyle,
  /** Small caps kicker — at most one or two per screen. */
  kicker: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: colors.muted } as TextStyle,
};

/** One radius for cards and sheets; pills are round. */
export const radius = { card: 20, sheet: 28, pill: 999 };

/** One soft ambient shadow. The old red "glow" is gone on purpose. */
export const shadow = {
  card: {
    shadowColor: "#111A3A",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  /** Kept for the few floating surfaces that sit over content (tab bar, sheets). */
  float: {
    shadowColor: "#111A3A",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  /** @deprecated the red glow. Resolves to the plain card shadow. */
  red: {
    shadowColor: "#111A3A",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
};

/** One press feel everywhere: 97% and a touch lighter. */
export const pressed = { transform: [{ scale: 0.97 }], opacity: 0.92 };

/** One curve for every entrance: fast out, gentle settle. */
export const ease = { out: [0.22, 1, 0.36, 1] as const };
