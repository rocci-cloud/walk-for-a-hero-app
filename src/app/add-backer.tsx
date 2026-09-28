import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useWalkerData } from "../auth/WalkerData";
import { Pill } from "../components/Pill";
import { Header } from "../components/ui";
import { base44 } from "../lib/base44";
import { MAX_PLEDGE_PER_MILE, money } from "../lib/data";
import { colors, fonts } from "../theme";

/**
 * Log a pledge someone arranged with the walker directly — exactly what the
 * website's "Log A Pledge" tab creates (same Backer fields, same rules).
 */
export default function AddBacker() {
  const { walker, hero, reloadAll } = useWalkerData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rate, setRate] = useState("5");
  const [max, setMax] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!walker) return null;

  const perMile = Number(rate.replace(/[^0-9.]/g, ""));
  const cap = max ? Number(max.replace(/[^0-9.]/g, "")) : 0;
  const valid = name.trim().length > 0 && perMile > 0 && perMile <= MAX_PLEDGE_PER_MILE && (!max || cap > 0);

  const save = async () => {
    if (!valid) {
      setError(perMile > MAX_PLEDGE_PER_MILE ? `Pledges go up to ${money(MAX_PLEDGE_PER_MILE, false)} a mile.` : "Add a name and a per-mile amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await base44.entities.Backer.create({
        walker_id: walker.id,
        walker_email: walker.email,
        walker_name: walker.name,
        walker_slug: walker.slug,
        hero_id: walker.hero_supported_id || hero?.id || "",
        hero_name: hero?.name || walker.hero_supported_name || "",
        backer_name: name.trim(),
        backer_email: email.trim(),
        pledge_per_mile: perMile,
        ...(cap > 0 ? { max_pledge: cap } : {}),
      });
      await reloadAll();
      router.back();
    } catch (e: any) {
      setError(e?.message ? `Couldn't save: ${e.message}` : "Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Header back eyebrow="BACKERS" title="Add a pledge" />
          <Text style={styles.body}>For a pledge someone made to you in person. It shows up on walkforahero.com too.</Text>

          <Field label="Backer's name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Their email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="$ per mile" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Most they'll give (optional)" value={max} onChangeText={setMax} keyboardType="decimal-pad" />
            </View>
          </View>
          {perMile > 0 && perMile <= MAX_PLEDGE_PER_MILE ? (
            <Text style={styles.hint}>
              At 15 miles that’s {money(cap > 0 ? Math.min(cap, perMile * 15) : perMile * 15)}. Nothing is charged until you collect it.
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Pill label="Save pledge" icon="arrow" busy={busy} onPress={save} style={{ marginTop: 22 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...rest} accessibilityLabel={label} style={styles.input} placeholderTextColor={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 40 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.secondary, marginTop: 14 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  input: {
    marginTop: 6,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.secondary, marginTop: 12 },
  error: { fontFamily: fonts.semibold, fontSize: 14, color: colors.red, marginTop: 12 },
});
