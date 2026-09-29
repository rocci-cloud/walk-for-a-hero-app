import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { base44 } from "../lib/base44";
import { colors, fonts, radius, shadow, type } from "../theme";
import { curve, prefersReducedMotion, tap } from "./motion";

/**
 * Backer cheers, mid-walk (2026-09-28). While a walk is open the phone asks
 * every 15 seconds for cheers sent since the walk began (send-cheer stores
 * them; it also pushes one, which covers the locked-phone case). Each new
 * cheer is a heavy tap and a card that slides in over the map for a few
 * seconds: "Maria — Keep going!". Cheers read only the walker's own rows.
 */
export type Cheer = { id: string; from_name: string; message: string; created_date?: string };

const POLL_MS = 15000;

export function useCheers(walkerId: string | undefined, sinceIso: string | undefined, enabled: boolean) {
  const [cheers, setCheers] = useState<Cheer[]>([]);
  const seen = useRef(new Set<string>());
  const [latest, setLatest] = useState<Cheer | null>(null);

  useEffect(() => {
    if (!enabled || !walkerId) {
      seen.current.clear();
      return;
    }
    let cancelled = false;
    const since = Date.parse(sinceIso || "") || 0;
    const poll = async () => {
      try {
        const rows: Cheer[] = await base44.entities.Cheer.filter({ walker_id: walkerId }, "-created_date", 50);
        if (cancelled) return;
        const fresh = (rows || []).filter((c) => (Date.parse(c.created_date || "") || 0) >= since - 60000);
        setCheers(fresh);
        // Announce only cheers that arrived after this poll started watching.
        const first = seen.current.size === 0;
        for (const c of fresh.slice().reverse()) {
          if (seen.current.has(c.id)) continue;
          seen.current.add(c.id);
          if (!first) {
            setLatest(c);
            tap.heavy();
          }
        }
        if (first && fresh.length === 0) seen.current.add("__primed");
      } catch {
        /* keep the last list */
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walkerId, sinceIso, enabled]);

  return { cheers: enabled ? cheers : [], latest, clearLatest: () => setLatest(null) };
}

export function CheerToast({ cheer, onDone, top }: { cheer: Cheer | null; onDone: () => void; top: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!cheer) return;
    v.setValue(0);
    const still = prefersReducedMotion();
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: still ? 0 : 420, easing: curve, useNativeDriver: true }),
      Animated.delay(3600),
      Animated.timing(v, { toValue: 0, duration: still ? 0 : 320, easing: curve, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone());
  }, [cheer, v, onDone]);
  if (!cheer) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        shadow.float,
        { top, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
      ]}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{cheer.from_name.trim()[0]?.toUpperCase() || "★"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {cheer.from_name} is cheering you on
        </Text>
        <Text style={styles.msg} numberOfLines={1}>
          “{cheer.message}”
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(201,160,76,0.5)",
  },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brass, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  name: { ...type.label },
  msg: { ...type.bodySm, fontFamily: fonts.storyItalic, fontSize: 15, color: colors.secondary },
});
