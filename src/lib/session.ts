import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { base44, callFunction, httpStatus, resetClient } from "./base44";
import { APP_AUTH_CALLBACK, SITE_URL } from "./config";
import { base64ToBase64Url, base64UrlFromBytes, parseAuthCallback } from "./pkce";

/**
 * Session handling for the app.
 *
 * The session token lives in the device keychain (iOS Keychain / Android
 * Keystore via expo-secure-store), never in plain storage. On launch it is
 * read back and handed to the Base44 client; a 401 from any call means it has
 * expired and the walker signs in again.
 *
 * Two ways in:
 *  - Email + password: the same login API the website's form calls. No
 *    browser involved.
 *  - Google / Apple: Base44 runs these as web redirects, so the app opens
 *    walkforahero.com/app-auth in the phone's secure sign-in browser and gets
 *    the session back through a one-time code + PKCE verifier (see the
 *    app-auth-handoff function on the website for why this is safe even if
 *    another app intercepts the walkforahero:// link).
 */

const TOKEN_KEY = "wfah.session.v1";

export async function restoreSession(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return false;
  base44.auth.setToken(token, false);
  return true;
}

async function adoptToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  base44.auth.setToken(token, false);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  resetClient();
}

export class SignInError extends Error {}

/** Email + password, exactly as the website's /login form. */
export async function signInWithEmail(email: string, password: string) {
  try {
    const res: any = await base44.auth.loginViaEmailPassword(email.trim(), password);
    const token = res?.access_token;
    if (!token) throw new Error("no token");
    await adoptToken(token);
  } catch (err) {
    const status = httpStatus(err);
    // One generic message on purpose (same as the website): never reveal
    // whether an email has an account.
    if (status === 400 || status === 401 || status === 403) {
      throw new SignInError("That email and password don't match an account. Check both and try again.");
    }
    throw new SignInError("We couldn't reach Walk For A Hero. Check your connection and try again.");
  }
}

function randomToken(bytes: number) {
  return base64UrlFromBytes(Crypto.getRandomBytes(bytes));
}

/**
 * Google or Apple, through walkforahero.com/app-auth.
 * Returns false if the walker closed the sign-in window.
 */
export async function signInWithProvider(provider: "google" | "apple"): Promise<boolean> {
  const verifier = randomToken(48); // 64 chars, within RFC 7636's 43–128
  const state = randomToken(24);
  const challenge = base64ToBase64Url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  );

  const q = `provider=${provider}&state=${encodeURIComponent(state)}&challenge=${encodeURIComponent(challenge)}`;
  const result = await WebBrowser.openAuthSessionAsync(`${SITE_URL}/app-auth?${q}`, APP_AUTH_CALLBACK);
  if (result.type !== "success") return false;

  const parsed = parseAuthCallback(result.url, state);
  if ("error" in parsed) {
    throw new SignInError("Sign-in didn't complete. Please try again.");
  }
  try {
    const out = await callFunction<{ access_token?: string }>("app-auth-handoff", {
      action: "redeem",
      code: parsed.code,
      verifier,
    });
    if (!out?.access_token) throw new Error("no token");
    await adoptToken(out.access_token);
    return true;
  } catch {
    throw new SignInError("Sign-in didn't complete. Please try again.");
  }
}
