import type { ExpoConfig } from "expo/config";

/**
 * Walk For A Hero — app configuration.
 *
 * Identifiers are permanent once the app is in the stores. They are set to the
 * Foundation's domain in reverse (com.walkforahero.app). If the Foundation's
 * Apple/Google accounts need a different ID, change it BEFORE the first
 * upload; after that it can never change.
 */

const IS_DEV = process.env.APP_VARIANT === "development";

const LOCATION_WHY =
  "Walk For A Hero records your route while a walk is running — including with the screen locked — so every mile you walk is counted for your hero. Location is only used between Start and Finish.";

const config: ExpoConfig = {
  name: IS_DEV ? "WFAH (dev)" : "Walk For A Hero",
  slug: "walk-for-a-hero",
  scheme: "walkforahero",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: "#F4EEE3",
  ios: {
    bundleIdentifier: IS_DEV ? "com.walkforahero.app.dev" : "com.walkforahero.app",
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: LOCATION_WHY,
      NSLocationAlwaysAndWhenInUseUsageDescription: LOCATION_WHY,
      UIBackgroundModes: ["location"],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: IS_DEV ? "com.walkforahero.app.dev" : "com.walkforahero.app",
    adaptiveIcon: {
      backgroundColor: "#F4EEE3",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
    ],
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-sqlite",
    "expo-secure-store",
    "expo-web-browser",
    "expo-font",
    "@maplibre/maplibre-react-native",
    [
      "expo-splash-screen",
      { image: "./assets/splash-icon.png", imageWidth: 180, backgroundColor: "#F4EEE3" },
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: LOCATION_WHY,
        locationWhenInUsePermission: LOCATION_WHY,
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    // Filled in by `eas init` (links this project to the Foundation's Expo account).
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
