import { useEffect } from "react";
import { Stack } from "expo-router";
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
import { colors } from "../theme";
import { applyUpdateNow } from "../lib/appUpdates";

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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      {/* Sign-in return link; reachable signed in or out (see auth.tsx). */}
      <Stack.Screen name="auth" options={{ animation: "none" }} />
    </Stack>
  );
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
