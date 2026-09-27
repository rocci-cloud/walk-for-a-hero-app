import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useAuth } from "../../auth/AuthContext";
import { Pill } from "../../components/Pill";
import { callFunction, functionError } from "../../lib/base44";
import { SITE_URL } from "../../lib/config";
import { openWalk } from "../../walk/store";
import { colors, fonts } from "../../theme";
import { runningVersion } from "../../lib/appUpdates";

/**
 * Account: sign out, and delete the account (Apple App Review 5.1.1(v)
 * requires deletion inside the app). Deletion calls the same delete-account
 * function as the website's "Delete my account" button.
 */
export default function Account() {
  const { state, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (state.status !== "signed_in") return null;
  const walker = state.walker;

  const unsentWalk = () => {
    const w = openWalk();
    return !!w && w.status !== "done";
  };

  const onSignOut = () => {
    if (unsentWalk()) {
      Alert.alert(
        "You have a walk that isn't counted yet",
        "Finish and send it on the Walk tab before signing out — signing out removes walks stored on this phone.",
      );
      return;
    }
    Alert.alert("Sign out?", "You can sign back in with the same account any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const onDelete = async () => {
    if (typed.trim().toUpperCase() !== "DELETE") return;
    setBusy(true);
    setError("");
    try {
      const out: any = await callFunction("delete-account", { confirm: "DELETE" });
      Alert.alert("Account deleted", out?.message || "Your account has been deleted.");
      await signOut();
    } catch (e) {
      setError(functionError(e) || "We couldn't reach Walk For A Hero. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Account</Text>

        <View style={styles.card}>
          <Text style={styles.name}>{walker?.name || state.user.full_name || "Walker"}</Text>
          <Text style={styles.email}>{state.user.email}</Text>
          {walker?.slug ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/walk/${walker.slug}`)} style={{ paddingTop: 10 }}>
              <Text style={styles.link}>View my walker page</Text>
            </Pressable>
          ) : null}
        </View>

        <Pill label="Sign out" variant="secondary" onPress={onSignOut} style={{ marginTop: 16 }} />

        <View style={styles.links}>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/privacy-policy`)}>
            <Text style={styles.link}>Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/terms-of-service`)}>
            <Text style={styles.link}>Terms of Service</Text>
          </Pressable>
        </View>

        <View style={styles.danger}>
          <Text style={styles.dangerTitle}>Delete my account</Text>
          <Text style={styles.body}>
            Removes your name, email, photo, every GPS route and your backers’ contact details. Credited miles and gifts stay on
            the hero’s total as “Deleted walker” — donors’ receipts and our tax records have to keep matching. This can’t be undone.
          </Text>
          {!deleting ? (
            <Pressable onPress={() => setDeleting(true)} style={{ paddingTop: 12 }}>
              <Text style={[styles.link, { color: colors.red }]}>Delete my account…</Text>
            </Pressable>
          ) : (
            <>
              <Text style={[styles.body, { marginTop: 12, fontFamily: fonts.bold, color: colors.ink }]}>Type DELETE to confirm</Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
                accessibilityLabel="Type DELETE to confirm"
              />
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Pill label="Keep account" variant="secondary" onPress={() => { setDeleting(false); setTyped(""); setError(""); }} style={{ flex: 1 }} />
                <Pill
                  label="Delete"
                  busy={busy}
                  disabled={typed.trim().toUpperCase() !== "DELETE"}
                  onPress={onDelete}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </View>

        <Text style={styles.version}>Walk For A Hero {Constants.expoConfig?.version ?? ""} · {runningVersion()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20, paddingBottom: 48 },
  title: { fontFamily: fonts.heavy, fontSize: 28, color: colors.ink, marginTop: 8 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 18, marginTop: 16 },
  name: { fontFamily: fonts.story, fontSize: 22, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 14, color: colors.secondary, marginTop: 4 },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.blue, textDecorationLine: "underline" },
  links: { flexDirection: "row", gap: 20, marginTop: 22, justifyContent: "center" },
  danger: { marginTop: 28, borderRadius: 20, borderWidth: 1, borderColor: "rgba(200,32,42,0.3)", padding: 16 },
  dangerTitle: { fontFamily: fonts.heavy, fontSize: 16, color: colors.red },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary, marginTop: 6 },
  input: {
    marginTop: 6,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 12,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  error: { fontFamily: fonts.semibold, color: colors.red, marginTop: 10, fontSize: 13 },
  version: { textAlign: "center", fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 28 },
});
