import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import Svg, { Circle, Defs, G, Image as SvgImage, LinearGradient, Path, Rect, Stop, Text as SvgText, TSpan } from "react-native-svg";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useWalkerData } from "../auth/WalkerData";
import { Pill } from "../components/Pill";
import { emblem, Header } from "../components/ui";
import { MISSION_MILES } from "../lib/config";
import { heroFullName, heroSubtitle } from "../lib/data";
import { getPoints, recentDone } from "../walk/store";
import type { PathPoint } from "../walk/capture";
import { colors } from "../theme";

/** Story size: 1080 × 1920, drawn at 360 × 640 and exported at 3×. */
const W = 360;
const H = 640;

/**
 * Route art (v3 board): the walk's SHAPE only — no map, no street names, no
 * coordinates — so a shared image never shows where the walker lives.
 */
function routePath(points: PathPoint[], box: { x: number; y: number; w: number; h: number }) {
  const pts = points;
  if (pts.length < 2) return null;
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p.lng * kx);
  const ys = pts.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const s = Math.min(box.w, box.h) / span;
  const ox = box.x + (box.w - (maxX - minX) * s) / 2;
  const oy = box.y + (box.h - (maxY - minY) * s) / 2;
  const P = pts.map((_, i) => [ox + (xs[i] - minX) * s, oy + (ys[i] - minY) * s] as const);
  const d = P.map(([x, y], i) => `${i && !pts[i].gap ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  return { d, start: P[0], end: P[P.length - 1] };
}

export default function RouteArt() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { walker, hero } = useWalkerData();
  const svgRef = useRef<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const points = useMemo(() => {
    const wid = id ? String(id) : recentDone(1)[0]?.id;
    return wid ? getPoints(wid) : [];
  }, [id]);
  const route = useMemo(() => routePath(points, { x: 50, y: 110, w: 260, h: 260 }), [points]);

  const miles = walker?.miles_walked || 0;
  const goal = walker?.goal_miles || MISSION_MILES;
  const heroLine = hero ? `for ${heroFullName(hero)}${heroSubtitle(hero) ? `, ${heroSubtitle(hero).split(" · ")[0]}` : ""}.` : "for a paralyzed veteran.";

  const toFile = () =>
    new Promise<string>((resolve, reject) => {
      if (!svgRef.current?.toDataURL) return reject(new Error("no canvas"));
      svgRef.current.toDataURL(
        (b64: string) => {
          try {
            const f = new File(Paths.cache, `walk-for-a-hero-${Date.now()}.png`);
            f.create({ overwrite: true });
            f.write(b64, { encoding: "base64" });
            resolve(f.uri);
          } catch (e) {
            reject(e);
          }
        },
        { width: W * 3, height: H * 3 },
      );
    });

  const share = async () => {
    setBusy(true);
    setMsg("");
    try {
      const uri = await toFile();
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your walk" });
    } catch {
      setMsg("Couldn't open the share menu. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const stripes = [colors.red, colors.white, colors.red, colors.white, colors.blue];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Header back eyebrow="Share" title="Route art" />
        <View style={styles.cardWrap}>
          <Svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
            <Defs>
              <LinearGradient id="route" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.brass} />
                <Stop offset="1" stopColor={colors.red} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} rx={28} fill={colors.paper} />
            <SvgImage href={emblem} x={28} y={30} width={40} height={40} />
            <SvgText x={78} y={56} fontFamily="Archivo_800ExtraBold" fontSize={13} letterSpacing={2.6} fill={colors.ink}>
              WALK FOR A HERO
            </SvgText>

            {route ? (
              <G>
                <Path d={route.d} stroke="url(#route)" strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={route.start[0]} cy={route.start[1]} r={9} fill={colors.paper} stroke={colors.brass} strokeWidth={4} />
                <Circle cx={route.end[0]} cy={route.end[1]} r={12} fill={colors.blue} />
                <Path
                  d={`M${route.end[0]} ${route.end[1] - 7}l2 4.3 4.7.5-3.5 3.2 1 4.6-4.2-2.4-4.2 2.4 1-4.6-3.5-3.2 4.7-.5z`}
                  fill={colors.white}
                />
              </G>
            ) : (
              <Circle cx={W / 2} cy={240} r={90} fill="none" stroke={colors.red} strokeOpacity={0.25} strokeWidth={8} />
            )}

            <SvgText x={28} y={470} fill={colors.ink}>
              <TSpan fontFamily="Archivo_900Black" fontSize={72}>
                {miles.toFixed(1)}
              </TSpan>
              <TSpan fontFamily="Archivo_700Bold" fontSize={24} fill={colors.secondary}>
                {` / ${goal} mi`}
              </TSpan>
            </SvgText>
            <SvgText x={28} y={512} fontFamily="Newsreader_500Medium" fontSize={23} fill={colors.ink}>
              {heroLine.length > 34 ? heroLine.slice(0, heroLine.lastIndexOf(" ", 34)) : heroLine}
            </SvgText>
            {heroLine.length > 34 ? (
              <SvgText x={28} y={540} fontFamily="Newsreader_500Medium" fontSize={23} fill={colors.ink}>
                {heroLine.slice(heroLine.lastIndexOf(" ", 34) + 1)}
              </SvgText>
            ) : null}
            {stripes.map((c, i) => (
              <Rect key={i} x={28 + i * 62} y={570} width={56} height={7} rx={3.5} fill={c} stroke={c === colors.white ? "rgba(17,26,58,0.08)" : "none"} />
            ))}
            <SvgText x={28} y={606} fontFamily="Archivo_700Bold" fontSize={13} fill={colors.secondary}>
              Back my walk · walkforahero.com
            </SvgText>
          </Svg>
        </View>
        <Text style={styles.fine}>Story size 1080 × 1920 · no street names or home location</Text>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <Pill label="Share to Stories or save" icon="arrow" busy={busy} onPress={share} style={{ marginTop: 16 }} />
        <Text style={styles.fine}>Pick Instagram or Facebook for Stories, or “Save image” to keep it in Photos.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paperDeep },
  pad: { padding: 20, paddingBottom: 40 },
  cardWrap: {
    marginTop: 16,
    alignSelf: "center",
    width: "82%",
    aspectRatio: W / H,
    transform: [{ rotate: "-1.5deg" }],
    shadowColor: "#111A3A",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
    borderRadius: 28,
  },
  fine: { fontFamily: "Archivo_400Regular", fontSize: 12.5, color: colors.secondary, textAlign: "center", marginTop: 14 },
  msg: { fontFamily: "Archivo_600SemiBold", fontSize: 14, color: colors.ink, textAlign: "center", marginTop: 10 },
});
