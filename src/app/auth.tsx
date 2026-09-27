import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { APP_AUTH_CALLBACK } from "../lib/config";
import { finishPendingProviderSignIn, SignInError } from "../lib/session";
import { colors, fonts } from "../theme";

/**
 * walkforahero://auth?code=…&state=… — the return link from the website's
 * /app-auth page after Google/Apple sign-in.
 *
 * Normally signInWithProvider (lib/session.ts) is still running and redeems
 * the code itself; this screen just steps aside (without it Android showed
 * "Unmatched Route", found in the first device test, 2026-09-27).
 *
 * If Android killed the app while the sign-in browser was open, the link
 * cold-starts the app and nothing is running: then this screen finishes the
 * sign-in from the attempt saved in the keychain.
 */
export default function AuthReturn() {
  const { code, state } = useLocalSearchParams<{ code?: string; state?: string }>();
  const { signedIn } = useAuth();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const leave = () => {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    };
    (async () => {
      try {
        const url = `${APP_AUTH_CALLBACK}?code=${encodeURIComponent(String(code ?? ""))}&state=${encodeURIComponent(String(state ?? ""))}`;
        const outcome = await finishPendingProviderSignIn(url);
        if (outcome === "signed_in") {
          await signedIn();
          router.replace("/");
          return;
        }
        setTimeout(leave, 50);
      } catch (e: any) {
        setError(e instanceof SignInError ? `${e.message}\n${e.detail}` : String(e?.message || e));
        setTimeout(leave, 4000);
      }
    })();
  }, [code, state, signedIn]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper, padding: 24 }}>
      {error ? (
        <Text style={{ fontFamily: fonts.semibold, color: colors.red, textAlign: "center" }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.red} />
      )}
    </View>
  );
}
