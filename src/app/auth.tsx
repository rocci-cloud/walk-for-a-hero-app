import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { colors } from "../theme";

/**
 * walkforahero://auth?code=…&state=… — the return link from the website's
 * /app-auth page after Google/Apple sign-in.
 *
 * The code itself is read and redeemed by signInWithProvider (lib/session.ts),
 * which receives the same URL from the sign-in browser session. On Android the
 * OS ALSO delivers the link to the app, and expo-router tries to open it as a
 * screen — without this file that showed "Unmatched Route" (found in the first
 * device test, 2026-09-27). This screen just steps aside: it goes back to
 * whatever was underneath (the sign-in screen, which is finishing the sign-in
 * and then switches to the app), or to the start if there is nothing to go back to.
 * The code is never read or stored here.
 */
export default function AuthReturn() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }, 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper }}>
      <ActivityIndicator color={colors.red} />
    </View>
  );
}
