import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useWalkerData } from "../auth/WalkerData";
import { Pill } from "../components/Pill";
import { Card, Header } from "../components/ui";
import { inviteTemplates, links } from "../lib/data";
import { colors, fonts } from "../theme";

/**
 * Invite a backer — the same three messages as the website's Invite dialog,
 * sent through the phone's own share sheet (Messages, WhatsApp, email, Copy…).
 * The link is the walker's walkforahero.com/donate?walker= link, where the
 * backer pledges or gives.
 */
export default function Invite() {
  const { walker, hero } = useWalkerData();
  const [pick, setPick] = useState("direct");
  if (!walker) return null;

  const link = links.backWalker(walker);
  const templates = inviteTemplates(walker.name, hero?.name || "", link);
  const chosen = templates.find((t) => t.id === pick) || templates[0];

  const send = () =>
    Share.share({ message: chosen.text, title: "Back my Walk For A Hero walk" }).catch(() => {});

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Header back eyebrow="INVITE" title="Invite a backer" />
        <Text style={styles.body}>Pick a message. It opens your phone’s share menu, so you can text it, email it, post it or copy it.</Text>

        <View style={styles.chips}>
          {templates.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityState={{ selected: t.id === pick }}
              onPress={() => setPick(t.id)}
              style={[styles.chip, t.id === pick && styles.chipOn]}
            >
              <Text style={[styles.chipText, t.id === pick && { color: colors.white }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Card style={{ marginTop: 14 }}>
          <Text style={styles.preview}>{chosen.text}</Text>
        </Card>

        <Text style={styles.linkLabel}>YOUR LINK</Text>
        <Text style={styles.linkText} selectable>
          {link.replace(/^https:\/\//, "")}
        </Text>

        <Pill label="Send message" icon="arrow" onPress={send} style={{ marginTop: 22 }} />
        <Pill label="Add a pledge by hand" variant="secondary" onPress={() => router.replace("/add-backer")} style={{ marginTop: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 40 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.secondary, marginTop: 14 },
  chips: { flexDirection: "row", gap: 8, marginTop: 16 },
  chip: { flex: 1, borderRadius: 999, borderWidth: 1.5, borderColor: colors.ink, paddingVertical: 10, alignItems: "center" },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  preview: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 23, color: colors.ink },
  linkLabel: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 1.8, color: colors.muted, marginTop: 20 },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.blue, marginTop: 4 },
});
