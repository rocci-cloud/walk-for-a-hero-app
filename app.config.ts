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
  // The marketing version both stores show. 1.0.0 for the first public
  // release — a 0.x on a store listing reads as unfinished, and Apple's
  // reviewers treat it that way. Build numbers are separate and are
  // auto-incremented by EAS (eas.json: appVersionSource "remote").
  version: "1.0.0",
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
    /*
     * iOS privacy manifest. Apple rejects uploads that use a "required
     * reason" API without declaring why (ITMS-91053), and Expo does NOT
     * generate this automatically — it only copies what is written here into
     * the native project.
     *
     * Every entry below is the union of the PrivacyInfo.xcprivacy files the
     * app's own dependencies ship, read from node_modules rather than
     * guessed, so the declaration matches what actually links in:
     *   FileTimestamp  C617.1  expo-application, React, cxxreact, glog,
     *                          RCT-Folly, boost
     *                  0A2A.1, 3B52.1  expo-file-system
     *   DiskSpace      E174.1, 85F4.1  expo-file-system
     *   UserDefaults   CA92.1  expo-constants, expo-notifications,
     *                          expo-task-manager, React
     *   SystemBootTime 35F9.1  boost, react/timing
     * Re-check this list whenever a native dependency is added or removed.
     *
     * The app tracks no one and shares nothing with data brokers, so
     * NSPrivacyTracking is false and the collected-data list stays empty.
     */
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
      ],
    },
  },
  android: {
    package: IS_DEV ? "com.walkforahero.app.dev" : "com.walkforahero.app",
    // Firebase project "walk-for-a-hero" (FCM for push notifications).
    googleServicesFile: "./google-services.json",
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
    // Route art is written to the app's own cache and handed to the share
    // menu, so no storage access is needed (and Google Play restricts it).
    blockedPermissions: ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"],
  },
  plugins: [
    "expo-router",
    "expo-status-bar",
    "expo-sqlite",
    "expo-secure-store",
    "expo-web-browser",
    "expo-font",
    "@maplibre/maplibre-react-native",
    "expo-sharing",
    [
      "expo-notifications",
      { icon: "./assets/notification-icon.png", color: "#C8202A", defaultChannel: "walk-updates" },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Walk For A Hero uses the photo you pick as your walker photo on walkforahero.com.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
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
  // The Foundation's Expo organization and project (expo.dev/accounts/walkforahero).
  owner: "walkforahero",
  // Over-the-air updates (EAS Update). Every push to main publishes an
  // update (.eas/workflows/update.yml); installed builds download it in the
  // background and use it on the next launch. runtimeVersion "fingerprint"
  // means an update only goes to builds with the SAME native code — a change
  // that needs a new build (new native library, permission, icon) is never
  // sent to phones that can't run it.
  runtimeVersion: { policy: "fingerprint" },
  updates: { url: "https://u.expo.dev/cc8d9475-79b6-4007-b78c-5dcfac8b0710" },
  extra: {
    eas: { projectId: "cc8d9475-79b6-4007-b78c-5dcfac8b0710" },
  },
};

export default config;
