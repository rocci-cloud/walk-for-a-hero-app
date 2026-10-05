import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useWalkerData } from "../auth/WalkerData";
import { Pill } from "../components/Pill";
import { HeroPhoto } from "../components/HeroPhoto";
import { Header } from "../components/ui";
import {
  checkWalkAgain,
  firstName,
  type Hero,
  heroFullName,
  heroSubtitle,
  isSettled,
  listHeroes,
  money,
  ordinal,
  startNewWalk,
  walkNumber,
} from "../lib/data";
import { colors, fonts, shadow } from "../theme";

/**
 * Walk again (Baker, 2026-09-28). Reached from Today and the walk result once
 * the walker has finished their 15 miles.
 *
 *   choose  — the hero they just walked for is first and pre-selected, so
 *             "the same hero again" is one tap; other heroes follow.
 *   confirm — says exactly what happens: the finished walk stays on their
 *             record, its pledges stay settled at the miles walked (and can
 *             still be collected), and the new walk starts at 0.
 *   done    — a quiet thank-you, then back to Today.
 *
 * start-new-walk does all of it on the server; this screen writes nothing.
 */
export default function WalkAgain() {
  const { walker, hero: currentHero, backers, reloadAll } = useWalkerData();
  const [heroes, setHeroes] = useState<Hero[] | null>(null);
  const [check, setCheck] = useState<{ eligible: boolean; reason: string } | null>(null);
  const [picked, setPicked] = useState("");
  const [step, setStep] = useState<"choose" | "confirm" | "done">("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Captured on open: after the start, `walker` is the NEW walk.
  const [snap] = useState(() => ({
    miles: walker?.miles_walked || 0,
    goal: walker?.goal_miles || 15,
    number: walkNumber(walker),
    heroName: currentHero?.name || walker?.hero_supported_name || "your hero",
    heroId: currentHero?.id || walker?.hero_supported_id || "",
    openPledges: backers.filter((b) => !b.collected && !isSettled(b)).length,
  }));

  useEffect(() => {
    Promise.all([listHeroes().catch(() => null), checkWalkAgain()]).then(([list, status]) => {
      if (!list) {
        setError("Couldn't load heroes. Check your connection and try again.");
        setHeroes([]);
      } else {
        const ordered = [...list].sort((a, b) => (a.id === snap.heroId ? -1 : b.id === snap.heroId ? 1 : 0));
        setHeroes(ordered);
        setPicked(snap.heroId && ordered.some((h) => h.id === snap.heroId) ? snap.heroId : ordered[0]?.id || "");
      }
      setCheck(status);
    });
  }, [snap.heroId]);

  const chosen = heroes?.find((h) => h.id === picked) || null;
  const next = snap.number + 1;

  const start = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError("");
    try {
      await startNewWalk(chosen.id);
      await reloadAll();
      setStep("done");
    } catch (e: any) {
      setError(e?.message || "Your next walk didn't start. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const loading = heroes === null || check === null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Header
          back={step !== "done"}
          eyebrow={step === "done" ? "WALKING AGAIN" : `YOUR ${ordinal(next).toUpperCase()} WALK`}
          title={step === "choose" ? "Who will you walk for?" : step === "confirm" ? `${snap.goal} miles for ${firstName(chosen?.name)}` : "Thank you."}
        />

        {loading ? (
          <ActivityIndicator color={colors.red} style={{ marginTop: 40 }} />
        ) : !check?.eligible && step !== "done" ? (
          <View style={[styles.notice]}>
            <Text style={styles.noticeText}>{check?.reason || "You can't start a new walk just yet."}</Text>
            <Pill label="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: 16 }} />
          </View>
        ) : step === "choose" ? (
          <>
            <Text style={styles.body}>
              {heroes!.length > 1
                ? `Walk for ${snap.heroName} again, or choose another hero. Another ${snap.goal} miles at your own pace, so a veteran can walk again.`
                : `Another ${snap.goal} miles at your own pace, so a veteran can walk again.`}
            </Text>
            {heroes!.map((h) => {
              const on = h.id === picked;
              return (
                <Pressable
                  key={h.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setPicked(h.id)}
                  style={[styles.card, shadow.card, on && styles.cardOn]}
                >
                  <HeroPhoto uri={h.photo_url} name={h.name} style={styles.photo} textSize={28} />
                  <View style={styles.cardText}>
                    {h.id === snap.heroId ? <Text style={styles.badge}>YOUR HERO</Text> : null}
                    <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
                      {heroFullName(h)}
                    </Text>
                    {heroSubtitle(h) ? <Text style={styles.sub}>{heroSubtitle(h)}</Text> : null}
                    <Text style={styles.raised}>
                      <Text style={{ color: "#2E7D4F", fontFamily: fonts.bold }}>{money(h.raised_amount, false)}</Text> of {money(h.goal_amount || 150000, false)} raised
                    </Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]} />
                </Pressable>
              );
            })}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pill label="Continue" icon="arrow" disabled={!chosen} onPress={() => setStep("confirm")} style={{ marginTop: 22 }} />
          </>
        ) : step === "confirm" ? (
          <>
            <Text style={styles.body}>Here is exactly what happens when you start.</Text>
            <View style={[styles.steps, shadow.card]}>
              {[
                `Your ${ordinal(snap.number)} walk is saved to your record: ${snap.miles.toFixed(1)} miles for ${snap.heroName}.`,
                snap.openPledges > 0
                  ? `Pledges from that walk stay settled at ${snap.miles.toFixed(1)} miles. The ${snap.openPledges === 1 ? "one" : snap.openPledges} you haven't collected yet can still be collected.`
                  : `Pledges from that walk stay settled at ${snap.miles.toFixed(1)} miles, exactly as your backers agreed.`,
                `Your new walk starts at 0 of ${snap.goal} miles for ${heroFullName(chosen)}. Invite your backers to follow this one too.`,
              ].map((line, i) => (
                <View key={i} style={[styles.stepRow, i > 0 && styles.stepRule]}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                  <Text style={styles.stepText}>{line}</Text>
                </View>
              ))}
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pill label={`Start my ${ordinal(next)} walk`} icon="play" busy={busy} onPress={start} style={{ marginTop: 22 }} />
            <Pill label="Back" variant="secondary" disabled={busy} onPress={() => setStep("choose")} style={{ marginTop: 10 }} />
          </>
        ) : (
          <>
            <Text style={styles.story}>
              Your {ordinal(next)} walk for {heroFullName(chosen)} has begun. Your walker page and link stay the same, and every mile you walked before is still on your record.
            </Text>
            <Pill label="Go to Today" icon="arrow" onPress={() => router.dismissTo("/")} style={{ marginTop: 24 }} />
            <Pill label="Invite backers to this walk" variant="secondary" onPress={() => router.replace("/invite")} style={{ marginTop: 10 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 48 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.secondary, marginTop: 14 },
  story: { fontFamily: fonts.story, fontSize: 22, lineHeight: 30, color: colors.ink, marginTop: 18 },
  notice: { marginTop: 18, padding: 18, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline },
  noticeText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  card: { marginTop: 16, borderRadius: 22, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  cardOn: { borderColor: colors.red },
  photo: { width: 92, alignSelf: "stretch", minHeight: 104, backgroundColor: colors.blue },
  cardText: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  badge: { fontFamily: fonts.heavy, fontSize: 10, letterSpacing: 1.8, color: colors.brassText, marginBottom: 2 },
  name: { fontFamily: fonts.story, fontSize: 22, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary, marginTop: 1 },
  raised: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 6 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.hairline, marginRight: 14 },
  radioOn: { borderColor: colors.red, borderWidth: 7 },
  steps: { marginTop: 16, borderRadius: 22, backgroundColor: colors.white, paddingHorizontal: 16 },
  stepRow: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  stepRule: { borderTopWidth: 1, borderTopColor: colors.hairline },
  stepNum: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.brass, textAlign: "center", lineHeight: 21, fontFamily: fonts.heavy, fontSize: 12, color: colors.brassText, overflow: "hidden" },
  stepText: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink },
  error: { fontFamily: fonts.semibold, fontSize: 14, color: colors.red, marginTop: 12 },
});
