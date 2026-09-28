import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useAuth } from "../auth/AuthContext";
import { Pill } from "../components/Pill";
import { callFunction, functionError , base44 } from "../lib/base44";
import { SITE_URL } from "../lib/config";
import { openWalk } from "../walk/store";
import { colors, fonts } from "../theme";
import { router, useFocusEffect } from "expo-router";
import { changeWalkerPhoto, removeWalkerPhoto, PhotoError } from "../lib/photo";
import { pushPermission, registerForPush, type PushState } from "../lib/push";
import { Avatar, Header, Row } from "../components/ui";
import { useWalkerData } from "../auth/WalkerData";
import { initials } from "../lib/data";
import { runningVersion } from "../lib/appUpdates";

/**
 * Account: sign out, and delete the account (Apple App Review 5.1.1(v)
 * requires deletion inside the app). Deletion calls the same delete-account
 * function as the website's "Delete my account" button.
 */
export default function Profile() {
  const { state, signOut } = useAuth();
  const { hero, reloadAll } = useWalkerData();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");
  const [push, setPush] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      pushPermission().then(setPush);
    }, []),
  );
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (state.status !== "signed_in") return null;
  const walker = state.walker;

  const onPhoto = async () => {
    if (!walker) return;
    setPhotoBusy(true);
    setPhotoMsg("");
    try {
      const url = await changeWalkerPhoto();
      if (url) {
        await reloadAll();
        setPhotoMsg("Photo updated. It shows on walkforahero.com too.");
      }
    } catch (e) {
      setPhotoMsg(e instanceof PhotoError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const onRemovePhoto = () =>
    Alert.alert("Remove your photo?", "Your initials will show instead.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setPhotoBusy(true);
          try {
            await removeWalkerPhoto();
            await reloadAll();
            setPhotoMsg("");
          } catch (e) {
            setPhotoMsg(e instanceof PhotoError ? e.message : "Something went wrong. Please try again.");
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);

  const turnOnPush = async () => {
    const r = await registerForPush(true);
    setPush(r);
    if (r === "blocked") Linking.openSettings().catch(() => {});
  };

  const pref = (key: "notify_gifts" | "notify_walk_reviews" | "notify_reminders") =>
    prefs[key] ?? ((walker as any)?.[key] !== false);

  const setPref = async (key: "notify_gifts" | "notify_walk_reviews" | "notify_reminders", value: boolean) => {
    if (!walker) return;
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      await base44.entities.Walker.update(walker.id, { [key]: value });
    } catch {
      setPrefs((p) => ({ ...p, [key]: !value }));
    }
  };

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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Header back eyebrow="PROFILE" title="You" />

        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar name={initials(walker?.name || state.user.full_name)} photo={walker?.photo_url} size={64} onPress={walker ? onPhoto : undefined} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{walker?.name || state.user.full_name || "Walker"}</Text>
              <Text style={styles.email}>{state.user.email}</Text>
              {walker ? (
                <View style={{ flexDirection: "row", gap: 16, marginTop: 6, alignItems: "center" }}>
                  <Pressable accessibilityRole="button" onPress={onPhoto} disabled={photoBusy}>
                    <Text style={styles.photoLink}>{walker.photo_url ? "Change photo" : "Add a photo"}</Text>
                  </Pressable>
                  {walker.photo_url ? (
                    <Pressable accessibilityRole="button" onPress={onRemovePhoto} disabled={photoBusy}>
                      <Text style={[styles.photoLink, { color: colors.muted }]}>Remove</Text>
                    </Pressable>
                  ) : null}
                  {photoBusy ? <ActivityIndicator color={colors.red} /> : null}
                </View>
              ) : null}
            </View>
          </View>
          {photoMsg ? <Text style={styles.photoMsg}>{photoMsg}</Text> : null}
          {walker?.slug ? (
            <Row label="My walker page" sub={`walkforahero.com/walk/${walker.slug}`} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/walk/${walker.slug}`)} />
          ) : null}
          <Row
            label="Walking for"
            sub={hero?.name || "No hero chosen yet"}
            onPress={hero ? () => router.navigate("/hero") : () => router.push("/choose-hero")}
          />
          <Row label="Change name or city" sub="On your walkforahero.com dashboard" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/dashboard`)} />
        </View>

        {walker ? (
          <>
            <Text style={styles.section}>NOTIFY ME WHEN</Text>
            <View style={styles.card}>
              {push !== "on" ? (
                <Row
                  label={push === "blocked" ? "Notifications are off for this app" : "Turn on notifications"}
                  sub={push === "blocked" ? "Turn them on in your phone's Settings." : "Know the moment someone gives or your walk is reviewed."}
                  onPress={turnOnPush}
                />
              ) : null}
              <Row
                label="Someone gives to my walk"
                right={<Switch value={pref("notify_gifts")} onValueChange={(v) => setPref("notify_gifts", v)} trackColor={{ true: colors.red, false: colors.paperDeep }} thumbColor={colors.white} />}
              />
              <Row
                label="A walk is reviewed"
                right={<Switch value={pref("notify_walk_reviews")} onValueChange={(v) => setPref("notify_walk_reviews", v)} trackColor={{ true: colors.red, false: colors.paperDeep }} thumbColor={colors.white} />}
              />
              <Row
                label="I left a walk unfinished"
                right={<Switch value={pref("notify_reminders")} onValueChange={(v) => setPref("notify_reminders", v)} trackColor={{ true: colors.red, false: colors.paperDeep }} thumbColor={colors.white} />}
              />
            </View>
          </>
        ) : null}

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
  section: { fontFamily: fonts.heavy, fontSize: 11, letterSpacing: 2, color: colors.muted, marginTop: 22, marginBottom: 8 },
  photoLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.blue },
  photoMsg: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink, marginTop: 10 },
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
