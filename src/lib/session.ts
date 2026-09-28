import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
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

/** `detail` is the underlying technical reason, shown small under the message so a failure can be diagnosed from a screenshot. */
export class SignInError extends Error {
  constructor(message: string, public readonly detail = "") {
    super(message);
  }
}

function describe(err: any): string {
  const status = httpStatus(err);
  const msg = String(err?.message || err || "").slice(0, 160);
  return status ? `HTTP ${status}: ${msg}` : msg;
}

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
      throw new SignInError("That email and password don't match an account. Check both and try again.", describe(err));
    }
    throw new SignInError("We couldn't reach Walk For A Hero. Check your connection and try again.", describe(err));
  }
}

function randomToken(bytes: number) {
  return base64UrlFromBytes(Crypto.getRandomBytes(bytes));
}

const PENDING_KEY = "wfah.pending_provider.v1";
const PENDING_TTL_MS = 10 * 60 * 1000;

/** The attempt this JS process is running right now, if any. */
let inFlight = false;

type Pending = { state: string; verifier: string; at: number };

async function redeem(code: string, verifier: string) {
  try {
    const out = await callFunction<{ access_token?: string }>("app-auth-handoff", {
      action: "redeem",
      code,
      verifier,
    });
    if (!out?.access_token) throw new Error("no token in reply");
    await adoptToken(out.access_token);
  } catch (err) {
    throw new SignInError("Sign-in didn't complete. Please try again.", `redeem: ${describe(err)}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Google or Apple, through walkforahero.com/app-auth.
 * Returns false if the walker closed the sign-in window.
 *
 * Android race (found 2026-09-27): expo-web-browser resolves the auth session
 * as "dismiss" when the app returns to the foreground, and that can win
 * against the walkforahero://auth link arriving — the app then thought the
 * walker had cancelled and silently stayed on the sign-in screen. So we also
 * listen for the link ourselves and give it a moment to arrive. And if
 * Android killed the app while the browser was open, the verifier is kept in
 * the keychain so the auth screen can finish the sign-in on the cold start
 * (finishPendingProviderSignIn below).
 */
export async function signInWithProvider(provider: "google" | "apple"): Promise<boolean> {
  const verifier = randomToken(48); // 64 chars, within RFC 7636's 43–128
  const state = randomToken(24);
  const challenge = base64ToBase64Url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  );
  const pending: Pending = { state, verifier, at: Date.now() };
  await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(pending)).catch(() => {});

  const linked: { url: string | null } = { url: null };
  const sub = Linking.addEventListener("url", ({ url }) => {
    if (url?.startsWith(APP_AUTH_CALLBACK)) linked.url = url;
  });
  inFlight = true;
  try {
    const q = `provider=${provider}&state=${encodeURIComponent(state)}&challenge=${encodeURIComponent(challenge)}`;
    const result = await WebBrowser.openAuthSessionAsync(`${SITE_URL}/app-auth?${q}`, APP_AUTH_CALLBACK);
    let url: string | null = result.type === "success" ? result.url : null;
    // Android: give the link up to 3 s to arrive after a "dismiss".
    for (let i = 0; !url && i < 30; i++) {
      if (linked.url) url = linked.url;
      else await sleep(100);
    }
    if (!url && linked.url) url = linked.url;
    if (!url) return false; // really closed the window

    const parsed = parseAuthCallback(url, state);
    if ("error" in parsed) {
      throw new SignInError("Sign-in didn't complete. Please try again.", `callback: ${parsed.error}`);
    }
    await redeem(parsed.code, verifier);
    return true;
  } finally {
    inFlight = false;
    sub.remove();
    await SecureStore.deleteItemAsync(PENDING_KEY).catch(() => {});
  }
}

/**
 * Called by the walkforahero://auth screen. If this process is already
 * handling the sign-in, does nothing (returns "handled_elsewhere"). If the app
 * was restarted while the browser was open, finishes the sign-in from the
 * attempt saved in the keychain.
 */
export async function finishPendingProviderSignIn(
  url: string,
): Promise<"handled_elsewhere" | "signed_in" | "nothing_pending"> {
  if (inFlight) return "handled_elsewhere";
  const raw = await SecureStore.getItemAsync(PENDING_KEY).catch(() => null);
  if (!raw) return "nothing_pending";
  await SecureStore.deleteItemAsync(PENDING_KEY).catch(() => {});
  let pending: Pending;
  try {
    pending = JSON.parse(raw);
  } catch {
    return "nothing_pending";
  }
  if (!pending?.verifier || Date.now() - pending.at > PENDING_TTL_MS) return "nothing_pending";
  const parsed = parseAuthCallback(url, pending.state);
  if ("error" in parsed) return "nothing_pending";
  await redeem(parsed.code, pending.verifier);
  return "signed_in";
}

/** The stored session token, for the one request the SDK can't make on a phone (photo upload). */
export async function currentToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
}
