import { useEffect } from "react";
import { Stack , router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Archivo_400Regular,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from "@expo-google-fonts/archivo";
import { Newsreader_500Medium, Newsreader_400Regular_Italic } from "@expo-google-fonts/newsreader";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { WalkerDataProvider } from "../auth/WalkerData";
import { colors } from "../theme";
import { applyUpdateNow } from "../lib/appUpdates";
import * as Notifications from "expo-notifications";

SplashScreen.preventAutoHideAsync().catch(() => {});
// Pick up an over-the-air fix on this launch rather than the next one.
applyUpdateNow();

function Gate() {
  const { state } = useAuth();
  const ready = state.status !== "loading";
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  const signedIn = state.status === "signed_in";
  return (
    <>
      <NotificationTaps enabled={signedIn} />
    <WalkerDataProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="choose-hero" />
          <Stack.Screen name="walk-again" />
          <Stack.Screen name="invite" />
          <Stack.Screen name="add-backer" options={{ presentation: "modal" }} />
          <Stack.Screen name="walk-result" options={{ contentStyle: { backgroundColor: colors.ink }, gestureEnabled: false }} />
          <Stack.Screen name="replay" options={{ contentStyle: { backgroundColor: colors.ink } }} />
          <Stack.Screen name="route-art" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        {/* Sign-in return link; reachable signed in or out (see auth.tsx). */}
        <Stack.Screen name="auth" options={{ animation: "none" }} />
      </Stack>
    </WalkerDataProvider>
    </>
  );
}

/** Tapping a notification opens the screen it's about. */
function NotificationTaps({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const go = (data: any) => {
      const kind = String(data?.type || data?.kind || "");
      if (/gift|pledge|backer|donation/i.test(kind)) router.navigate("/backers");
      else if (/walk|cheer/i.test(kind)) router.navigate("/walk");
      else router.navigate("/");
    };
    // Never let notification plumbing take the app down.
    try {
      const last = Notifications.getLastNotificationResponse();
      if (last) go(last.notification.request.content.data);
    } catch {
      /* not available */
    }
    let sub: { remove: () => void } | null = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener((r) => go(r.notification.request.content.data));
    } catch {
      sub = null;
    }
    return () => sub?.remove();
  }, [enabled]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
    Newsreader_500Medium,
    Newsreader_400Regular_Italic,
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
