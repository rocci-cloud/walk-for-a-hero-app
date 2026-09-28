# Walk For A Hero — mobile app

The walker app for [walkforahero.com](https://walkforahero.com). iPhone and Android, built with Expo (SDK 57) and React Native.

**This is the build test ("spike").** It proves the three parts that could sink the app before the full v3 design is built:

1. **Sign-in** with the same account as the website (email + password, Google, and Apple once it's switched on).
2. **A real GPS walk** with the phone locked in a pocket, credited by the same `log-walk-miles` function the website uses.
3. **The map**: free MapLibre + OpenFreeMap, with the brass-to-red route.

The v3 app: four tabs, **Today** (ring, pledged vs raised, mile ledger, hero), **Walk** (night map, live sheet, press-and-hold Finish), **Backers** (the website's Backer records, invite through the share menu, log a pledge) and **Hero** (photo, story, raised total, Give on walkforahero.com). Profile sits behind the avatar. After a walk: **Walk credited** (worded from the server's answer), **Replay** with mile splits, and **Route art** (route shape only, no map or street names) shared through the phone's share menu.

## How it connects to the website

There's one backend, the website's Base44 app (`6a5ea09f92a56e347e3049b7`), and no second database. The app reads and writes the same accounts, walker records, miles and money.

| App does | Talks to |
|---|---|
| Email sign-in | Base44 login API (same as walkforahero.com/login) |
| Google / Apple sign-in | walkforahero.com/app-auth → `app-auth-handoff` (one-time code + PKCE) |
| Today screen | `Walker` record, `Hero` record |
| Finish a walk | `log-walk-miles` (offline-style finish with a `client_token`, credited exactly once) |
| Delete account | `delete-account` (same as the website's button) |

## How a walk is recorded

- GPS runs as a **background location task** (`src/walk/locationTask.ts`), so walks keep recording with the screen locked or while using another app. On Android an ongoing notification is shown, as Android requires.
- Every accepted point is saved to the phone's own SQLite database right away (`src/walk/store.ts`). A dead battery, a killed app or no signal can't lose a walk.
- The capture rules (`src/walk/capture.ts`) are the website's, using the website's own `geo.js` copied byte-for-byte (see `src/lib/GEO_SOURCE.md`): warm-up, jitter filter, signal-gap counting, and pause breaks.
- At **Finish** the whole route is sent once, with a token made at Start. If there's no signal, it waits on the phone and is re-sent with the same token, which the server uses to credit it only once.
- The server re-checks everything: speed, gaps and the 30-day window. The phone never decides miles.

## Checks

```bash
npm install
npx tsc --noEmit          # types
npx expo lint             # lint
npm test                  # capture rules + PKCE (10 tests)
npx expo export --platform ios --platform android   # both platforms compile
```

## Run it on a phone

You need a free [Expo](https://expo.dev) account. No Mac is needed; Expo builds in the cloud.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                     # links this project; writes the project id
npx eas-cli@latest build --profile development --platform android   # installable APK, no store account needed
npx eas-cli@latest build --profile development --platform ios       # needs the Apple Developer account
npx expo start --dev-client                 # then open the dev build on the phone
```

Expo Go won't work: background GPS and the map need a development build.

## Over-the-air updates

Installed builds get JavaScript/screen fixes automatically: every push to `main` runs `.eas/workflows/update.yml` on Expo, which publishes an update to the `preview` channel. The phone downloads it in the background and uses it the **next time the app is opened** (close it fully and reopen to get it right away). Changes that need new native code (a new library, permission, icon or splash) can't go over the air. `runtimeVersion: fingerprint` keeps those away from phones that can't run them, and they need a new build.

## First real walk test (the whole point of the spike)

Do this on one iPhone and one Android phone:

1. Sign in with a walker account. Try email, then Google.
2. On **Walk**, press Start. Allow location **"Always" / "Allow all the time"**.
3. Lock the phone, put it in a pocket, and walk **at least 1 mile** outdoors. Include one stop of about 2 minutes.
4. Halfway, turn on airplane mode for a few minutes, then turn it off.
5. Unlock and press Finish.
6. Check that the miles shown match walkforahero.com/dashboard for that account, and that Admin › Walk Review shows the walk.
7. Repeat once with airplane mode on at Finish. The walk should wait, then send by itself when signal returns, and be counted **once**.

## Before the store

- The icon, adaptive icon and splash are built from the Foundation emblem (`assets/brand/emblem.png`, 246 px). They are sharp at phone sizes; for the 512 px store listing icon, replace them with the vector logo.
- Confirm the bundle ID `com.walkforahero.app` with the Foundation's Apple/Google accounts **before the first upload**. It can never change after that.
- Turn on `APPLE_SIGNIN_ENABLED` in `src/lib/config.ts` (and the website's flag) once Apple is enabled in Base44.
- Still to build: push notifications (`register-push-token` is ready on the server; needs the Foundation's Firebase project for Android), changing the walker photo in the app (`set-walker-photo`), live sharing, the Wallet card and Live Activities.

© Walk For A Hero Foundation. All rights reserved.
