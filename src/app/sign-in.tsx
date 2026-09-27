import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../auth/AuthContext";
import { Pill } from "../components/Pill";
import { APPLE_SIGNIN_ENABLED, SITE_URL } from "../lib/config";
import { signInWithEmail, signInWithProvider, SignInError } from "../lib/session";
import { colors, fonts } from "../theme";
import { runningVersion } from "../lib/appUpdates";

export default function SignIn() {
  const { signedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google" | "apple">(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");

  const run = async (kind: "email" | "google" | "apple") => {
    setError("");
    setDetail("");
    setBusy(kind);
    try {
      if (kind === "email") {
        if (!email.trim() || !password) {
          setError("Enter your email and password.");
          return;
        }
        await signInWithEmail(email, password);
      } else {
        const ok = await signInWithProvider(kind);
        if (!ok) return; // closed the sign-in window
      }
      await signedIn();
    } catch (e: any) {
      setError(e instanceof SignInError ? e.message : "Something went wrong. Please try again.");
      setDetail(e instanceof SignInError ? e.detail : String(e?.message || e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>WALK FOR A HERO</Text>
          <Text style={styles.h1}>Walk 15 miles so a veteran can walk again.</Text>
          <Text style={styles.lede}>Sign in with the same account you use on walkforahero.com.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              style={styles.input}
              accessibilityLabel="Email"
            />
            <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              style={styles.input}
              accessibilityLabel="Password"
              onSubmitEditing={() => run("email")}
            />
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {detail ? <Text style={styles.detail}>{detail}</Text> : null}
            <Pill label="Sign in" icon="arrow" busy={busy === "email"} disabled={!!busy} onPress={() => run("email")} style={{ marginTop: 18 }} />
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/forgot-password`)} style={styles.linkRow}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>

          <Text style={styles.or}>or</Text>
          <Pill label="Continue with Google" variant="secondary" busy={busy === "google"} disabled={!!busy} onPress={() => run("google")} />
          {APPLE_SIGNIN_ENABLED && (
            <Pill label="Continue with Apple" variant="dark" busy={busy === "apple"} disabled={!!busy} onPress={() => run("apple")} style={{ marginTop: 10 }} />
          )}

          <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/become-a-walker`)} style={[styles.linkRow, { marginTop: 22 }]}>
            <Text style={styles.link}>New here? Become a walker at walkforahero.com</Text>
          </Pressable>
          <Text style={styles.version}>{runningVersion()}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: 20, paddingBottom: 40 },
  eyebrow: { fontFamily: fonts.heavy, fontSize: 12, letterSpacing: 2.4, color: colors.brassText, marginTop: 24 },
  h1: { fontFamily: fonts.story, fontSize: 32, lineHeight: 36, color: colors.ink, marginTop: 10 },
  lede: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.secondary, marginTop: 10 },
  card: { backgroundColor: colors.white, borderRadius: 26, padding: 18, marginTop: 24 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  input: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  error: { fontFamily: fonts.semibold, color: colors.red, marginTop: 12, fontSize: 14, lineHeight: 20 },
  linkRow: { paddingVertical: 12, alignItems: "center" },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.blue, textDecorationLine: "underline" },
  detail: { fontFamily: fonts.body, color: colors.muted, marginTop: 6, fontSize: 11, lineHeight: 15 },
  version: { textAlign: "center", fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginTop: 8 },
  or: { textAlign: "center", fontFamily: fonts.semibold, color: colors.muted, marginVertical: 14 },
});
