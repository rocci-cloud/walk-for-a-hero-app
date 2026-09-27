/**
 * One place for everything that ties the app to walkforahero.com. The app and
 * the website share ONE Base44 backend (app 6a5ea09f92a56e347e3049b7): same
 * accounts, same walker records, same miles and money. There is no second
 * database to keep in sync.
 */
export const BASE44_APP_ID = "6a5ea09f92a56e347e3049b7";
export const BASE44_SERVER_URL = "https://base44.app";
export const SITE_URL = "https://walkforahero.com";

/** Where the website's /app-auth page sends the phone back to (see app.config.ts `scheme`). */
export const APP_AUTH_CALLBACK = "walkforahero://auth";

/**
 * Sign in with Apple. Apple requires it in the app because Google sign-in is
 * offered (App Review 4.8). It stays hidden until Apple is switched on in the
 * Base44 dashboard, exactly like APPLE_SIGNIN_ENABLED on the website — turn
 * both on together.
 */
export const APPLE_SIGNIN_ENABLED = false;

/** The mission, as the website defines it (src/lib/portal.js on the site). */
export const MISSION_MILES = 15;
export const WALK_WINDOW_DAYS = 30;
