/**
 * v3 palette — taken from the Walk For A Hero emblem (see the design canvas,
 * page "v3 · Color & GPS"). Contrast-checked: muted text on paper is 5.36:1.
 */
export const colors = {
  red: "#C8202A", // flag red: the mission, every primary action
  redBright: "#E23A3A", // route end on the night map
  blue: "#1B2C8F", // royal blue: structure, the star
  brass: "#C9A04C", // milestones, route start
  brassText: "#8A6424", // brass for text on paper
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

export const radius = { card: 26, shell: 32, pill: 999 };

export const shadow = {
  card: {
    shadowColor: "#111A3A",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  red: {
    shadowColor: "#C8202A",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};
