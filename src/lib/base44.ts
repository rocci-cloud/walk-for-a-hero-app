import { createClient } from "@base44/sdk";
import { BASE44_APP_ID, BASE44_SERVER_URL } from "./config";

/**
 * The same Base44 client the website uses, pointed at the same app. The SDK
 * is React-Native aware (it skips window.location/localStorage/document when
 * they are absent); analytics is off because it is a browser feature.
 *
 * The token is NOT kept by the SDK on a phone (there is no localStorage);
 * session.ts owns it in the device keychain and hands it to setToken().
 */
function makeClient() {
  return createClient({
    appId: BASE44_APP_ID,
    serverUrl: BASE44_SERVER_URL,
    requiresAuth: false,
    analytics: { enabled: false },
  });
}

// `let`, not `const`: signing out replaces the whole client (see resetClient).
export let base44 = makeClient();

/**
 * Sign-out on a phone. The SDK's logout() is built for browsers: it redirects
 * the page, and it clears the token from its main HTTP client but not from
 * the one it uses for backend functions. Replacing the client is the only
 * way to be sure no old session is still attached to any request.
 * ES module `let` exports are live bindings, so every importer sees the new
 * client.
 */
export function resetClient() {
  base44 = makeClient();
}

/**
 * Call a backend function by its deployed (kebab-case) name — the same
 * convention as callFunction on the website.
 */
export async function callFunction<T = any>(name: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res: any = await base44.functions.invoke(name, payload);
  return (res?.data ?? res) as T;
}

/** The function's own `error` message, or null for a transport failure. */
export function functionError(err: any): string | null {
  const body = err?.response?.data ?? err?.data ?? null;
  const msg = body && (body.error || body.detail || body.message);
  return msg ? String(msg) : null;
}

export function httpStatus(err: any): number | null {
  return err?.response?.status ?? err?.status ?? null;
}
