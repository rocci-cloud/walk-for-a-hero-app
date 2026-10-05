import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useWalkerData } from "../auth/WalkerData";
import { Pill } from "../components/Pill";
import { HeroPhoto } from "../components/HeroPhoto";
import { Header } from "../components/ui";
import { base44 } from "../lib/base44";
import { firstName, heroSubtitle, listHeroes, money, type Hero } from "../lib/data";
import { colors, fonts, shadow } from "../theme";

/**
 * "Who will you walk for?" — for a walker whose profile has no hero yet.
 * Writes hero_supported_id (the Hero record id) and the denormalised
 * hero_supported_name, the same two fields walker-signup sets on the website.
 */
export default function ChooseHero() {
  const { walker, reloadAll } = useWalkerData();
  const [heroes, setHeroes] = useState<Hero[] | null>(null);
  const [picked, setPicked] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listHeroes()
      .then((l) => {
        setHeroes(l);
        if (l.length === 1) setPicked(l[0].id);
      })
      .catch(() => setError("Couldn't load heroes. Check your connection and try again."));
  }, []);

  const hero = heroes?.find((h) => h.id === picked);

  const save = async () => {
    if (!walker || !hero) return;
    setBusy(true);
    setError("");
    try {
      await base44.entities.Walker.update(walker.id, { hero_supported_id: hero.id, hero_supported_name: hero.name });
      await reloadAll();
      router.back();
    } catch (e: any) {
      setError(e?.message ? `Couldn't save: ${e.message}` : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Header back eyebrow="Your hero" title="Who will you walk for?" />
        <Text style={styles.body}>
          Every walker is paired with one named veteran. Your miles and your backers’ pledges go to that hero’s exoskeleton package.
        </Text>

        {!heroes && !error ? <ActivityIndicator color={colors.red} style={{ marginTop: 30 }} /> : null}

        {heroes?.map((h) => {
          const on = h.id === picked;
          return (
            <Pressable
              key={h.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setPicked(h.id)}
              style={[styles.card, shadow.card, on && styles.cardOn]}
            >
              <HeroPhoto uri={h.photo_url} name={h.name} style={styles.photo} textSize={56} />
              <View style={{ padding: 16 }}>
                {h.is_anchor ? <Text style={styles.badge}>FOUNDING HERO</Text> : null}
                <Text style={styles.name}>{h.name}</Text>
                <Text style={styles.sub}>{heroSubtitle(h)}</Text>
                <View style={styles.pkg}>
                  <Text style={styles.pkgLabel}>EXOSKELETON PACKAGE</Text>
                  <Text style={styles.pkgValue}>{money(h.goal_amount || 150000, false)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}

        {heroes && heroes.length > 0 ? <Text style={styles.more}>More heroes appear here as the Foundation verifies them.</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Pill
          label={hero ? `Walk for ${firstName(hero.name)}` : "Pick a hero"}
          icon="arrow"
          disabled={!hero}
          busy={busy}
          onPress={save}
          style={{ marginTop: 20 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 40 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.secondary, marginTop: 14 },
  card: { marginTop: 18, borderRadius: 26, backgroundColor: colors.white, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  cardOn: { borderColor: colors.red },
  photo: { height: 150 },
  badge: { alignSelf: "flex-start", fontFamily: fonts.heavy, fontSize: 10, letterSpacing: 1.6, color: colors.ink, backgroundColor: colors.brass, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden", marginBottom: 8 },
  name: { fontFamily: fonts.story, fontSize: 26, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.secondary, marginTop: 2 },
  pkg: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.hairline },
  pkgLabel: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.6, color: colors.muted },
  pkgValue: { fontFamily: fonts.black, fontSize: 16, color: colors.ink },
  more: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 16 },
  error: { fontFamily: fonts.semibold, fontSize: 14, color: colors.red, marginTop: 12 },
});
