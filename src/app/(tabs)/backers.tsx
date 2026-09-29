import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useWalkerData } from "../../auth/WalkerData";
import { Pill } from "../../components/Pill";
import { Card, Header } from "../../components/ui";
import { SITE_URL } from "../../lib/config";
import { backerCurrentCharge, initials, isSettled, links, money, pledgeMiles, pledgeSummary, PROJECTION_NOTE } from "../../lib/data";
import { colors, fonts, type } from "../../theme";
import { CountUp, Rise, tap } from "../../components/motion";

/**
 * Backers — the same records as "My Backers" on walkforahero.com/dashboard.
 * Per-mile pledges are logged by the walker; the running figure for each uses
 * the website's backerCurrentCharge, so both show the same dollars.
 */
export default function Backers() {
  const { walker, backers, reloadAll } = useWalkerData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadAll();
    setRefreshing(false);
  };

  if (!walker) return <SafeAreaView style={styles.safe} />;

  const miles = walker.miles_walked || 0;
  const p = pledgeSummary(backers, miles);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Header
          eyebrow="Your backers"
          title="Backers"
          right={
            <Pressable accessibilityRole="button" onPress={() => { tap.light(); router.push("/invite"); }} style={({ pressed }) => [styles.invite, pressed && { opacity: 0.85 }]}>
              <Text style={styles.inviteText}>+ Invite</Text>
            </Pressable>
          }
        />

        <Rise index={0}>
        <Card style={{ marginTop: 18 }}>
          <Text style={styles.label}>Raised · money in hand</Text>
          <CountUp value={walker.total_raised || 0} format={(n) => money(n)} style={[styles.big, { color: colors.money }]} />
          <Text style={styles.sub}>Collected pledges and direct gifts</Text>
          <View style={styles.rule} />
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>To collect</Text>
              <Text style={styles.mid}>{money(p.pledgedToCollect)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Per mile</Text>
              <Text style={styles.mid}>{money(p.perMile)}</Text>
            </View>
          </View>
          {p.count > 0 && (
            <Text style={[styles.sub, { marginTop: 8 }]}>If you finish all 15 miles: {money(p.pledgedAtFinish)} pledged.</Text>
          )}
        </Card>
        </Rise>

        {backers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Every backer multiplies your miles.</Text>
            <Text style={styles.emptyBody}>
              Send your link. Backers pledge per mile on walkforahero.com, or give once, and follow your progress there.
            </Text>
            <Pill label="Invite a backer" icon="arrow" onPress={() => router.push("/invite")} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.section}>Pledges · {backers.length}</Text>
            {[...backers.filter((b) => !isSettled(b)), ...backers.filter((b) => isSettled(b))].map((b, i, list) => (
              <View key={b.id}>
              {isSettled(b) && (i === 0 || !isSettled(list[i - 1])) ? <Text style={[styles.section, { marginTop: 14 }]}>From earlier walks</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Opens this backer's page on walkforahero.com"
                onPress={() => WebBrowser.openBrowserAsync(links.backerPortal(b))}
                style={({ pressed }) => [styles.backer, pressed && { opacity: 0.6 }]}
              >
                <View style={styles.initials}>
                  <Text style={styles.initialsText}>{initials(b.backer_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.backerName} numberOfLines={1}>
                    {b.backer_name}
                  </Text>
                  <Text style={styles.backerSub}>
                    {b.collected
                      ? `Collected ${money(b.collected_amount)}`
                      : isSettled(b)
                        ? `Walk ${b.walk_number || 1} · ${money(backerCurrentCharge(b, pledgeMiles(b, miles)))} to collect`
                        : `${money(backerCurrentCharge(b, miles))} so far${b.max_pledge ? ` · up to ${money(b.max_pledge, false)}` : ""}`}
                  </Text>
                </View>
                <Text style={styles.rate}>
                  {money(b.pledge_per_mile)}
                  <Text style={styles.rateUnit}>/mi</Text>
                </Text>
              </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pill label="Add a pledge by hand" variant="secondary" onPress={() => router.push("/add-backer")} style={{ marginTop: 18 }} />
        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/dashboard`)} style={{ paddingVertical: 14, alignItems: "center" }}>
          <Text style={styles.link}>Collect pledges on walkforahero.com</Text>
        </Pressable>
        <Text style={styles.note}>{PROJECTION_NOTE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 130 },
  invite: { backgroundColor: colors.red, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  inviteText: { ...type.labelSm, color: colors.white },
  label: { ...type.labelSm, color: colors.muted },
  big: { ...type.figure, marginTop: 2 },
  mid: { ...type.figureSm, marginTop: 2 },
  sub: { ...type.bodySm, marginTop: 2 },
  rule: { height: 1, backgroundColor: colors.hairline, marginVertical: 14 },
  empty: { marginTop: 22, padding: 20, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline },
  emptyTitle: { ...type.display, fontSize: 24, lineHeight: 30 },
  emptyBody: { ...type.bodySm, fontSize: 14.5, lineHeight: 21, marginTop: 6 },
  section: { ...type.kicker, marginBottom: 4 },
  backer: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  initials: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(27,44,143,0.09)", alignItems: "center", justifyContent: "center" },
  initialsText: { fontFamily: fonts.bold, color: colors.blue, fontSize: 14 },
  backerName: { ...type.label },
  backerSub: { ...type.bodySm, color: colors.muted, marginTop: 1 },
  rate: { ...type.labelSm, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  rateUnit: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  link: { ...type.labelSm, color: colors.blue, textDecorationLine: "underline" },
  note: { ...type.bodySm, fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: "center" },
});
