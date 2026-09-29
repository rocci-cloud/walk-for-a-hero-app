import { useEffect, useState } from "react";
import { Animated } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { colors } from "../theme";
import { curve, prefersReducedMotion } from "./motion";

/**
 * The v3 signature: progress drawn as the logo's own red-and-white striped
 * ring (three concentric bands), capped with a royal-blue star. The ring
 * draws itself to its value over 900 ms, and the miles count up with it
 * (design audit, 2026-09-28).
 */
export function ProgressRing({
  miles,
  goal,
  size = 176,
  label,
}: {
  miles: number;
  goal: number;
  size?: number;
  label?: string;
}) {
  const target = Math.max(0, Math.min(1, goal > 0 ? miles / goal : 0));
  const still = prefersReducedMotion();
  const [animPct, setPct] = useState(0);
  const [animShown, setShown] = useState(0);
  const pct = still ? target : animPct;
  const shown = still ? miles : animShown;

  useEffect(() => {
    if (still) return;
    const v = new Animated.Value(0);
    const fromPct = pct;
    const fromMiles = shown;
    const id = v.addListener(({ value: t }) => {
      setPct(fromPct + (target - fromPct) * t);
      setShown(fromMiles + (miles - fromMiles) * t);
    });
    const a = Animated.timing(v, { toValue: 1, duration: 900, easing: curve, useNativeDriver: false });
    a.start();
    return () => {
      v.removeListener(id);
      a.stop();
    };
    // Re-run only when the real values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, miles, still]);

  const radii = [62, 72, 82];
  const angle = -Math.PI / 2 + pct * 2 * Math.PI;
  const capX = 100 + 82 * Math.cos(angle);
  const capY = 100 + 82 * Math.sin(angle);
  const star = (cx: number, cy: number) =>
    `M${cx} ${cy - 8}l2.3 5 5.5.5-4.1 3.7 1.2 5.4-4.9-2.9-4.9 2.9 1.2-5.4-4.1-3.7 5.5-.5z`;
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel={`${miles.toFixed(1)} of ${goal} miles`}>
      <G fill="none" strokeWidth={5}>
        {radii.map((r) => (
          <Circle key={`t${r}`} cx={100} cy={100} r={r} stroke={colors.red} strokeOpacity={0.13} />
        ))}
        {pct > 0.002 &&
          radii.map((r) => {
            const c = 2 * Math.PI * r;
            return (
              <Circle
                key={`p${r}`}
                cx={100}
                cy={100}
                r={r}
                stroke={colors.red}
                strokeDasharray={`${c * pct} ${c}`}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
              />
            );
          })}
      </G>
      <Circle cx={capX} cy={capY} r={14} fill={colors.blue} stroke={colors.white} strokeWidth={3} />
      <Path d={star(capX, capY)} fill={colors.white} />
      <SvgText x={100} y={106} textAnchor="middle" fontFamily="Archivo_800ExtraBold" fontSize={40} fill={colors.ink}>
        {shown.toFixed(1)}
      </SvgText>
      <SvgText x={100} y={128} textAnchor="middle" fontFamily="Archivo_600SemiBold" fontSize={13} fill={colors.muted}>
        {label ?? `of ${goal} miles`}
      </SvgText>
    </Svg>
  );
}
