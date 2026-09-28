import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { callFunction } from "./base44";

/**
 * Push notifications. The server side already exists: register-push-token
 * stores this phone's Expo push token against the signed-in account, and
 * stripe-webhook / review-walk-session / cleanup-walk-sessions send through
 * Expo's push service, honouring the walker's notify_* preferences.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CHANNEL = "walk-updates"; // matches defaultChannel in app.config.ts

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Walk updates",
    description: "New gifts and backers, walk reviews and reminders",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#C8202A",
  });
}

let lastToken: string | null = null;

export type PushState = "on" | "off" | "blocked" | "unavailable";

export async function pushPermission(): Promise<PushState> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return "on";
    return p.canAskAgain ? "off" : "blocked";
  } catch {
    return "unavailable";
  }
}

/**
 * Register this phone. `ask` shows the system prompt if needed; without it,
 * this only refreshes the token for someone who already said yes (called on
 * every launch, since tokens can change).
 */
export async function registerForPush(ask: boolean): Promise<PushState> {
  try {
    await ensureChannel();
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return perm.canAskAgain ? "off" : "blocked";
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    lastToken = token;
    await callFunction("register-push-token", {
      action: "register",
      token,
      platform: Platform.OS === "android" ? "android" : "ios",
      app_version: Constants.expoConfig?.version ?? "",
    });
    return "on";
  } catch {
    return "unavailable";
  }
}

/** On sign-out: stop this phone receiving the previous account's notifications. */
export async function unregisterPush() {
  try {
    const token = lastToken ?? (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId,
    })).data;
    await callFunction("register-push-token", { action: "unregister", token });
  } catch {
    /* best effort */
  }
  lastToken = null;
}
