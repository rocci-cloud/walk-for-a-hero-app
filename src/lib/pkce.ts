/**
 * PKCE helpers (RFC 7636, S256) for the Google/Apple sign-in handoff.
 * Pure functions are kept separate from expo-crypto so they can be tested in
 * plain Node (see test/pkce.test.mjs).
 */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Bytes → unpadded base64url. */
export function base64UrlFromBytes(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63];
  }
  return out.replace(/\+/g, "-").replace(/\//g, "_");
}

/** Standard (padded or not) base64 → unpadded base64url. */
export function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/;
export const CODE_RE = /^[A-Za-z0-9_-]{43}$/;
export const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** Parse walkforahero://auth?code=&state= and check it belongs to this attempt. */
export function parseAuthCallback(url: string, expectedState: string): { code: string } | { error: string } {
  const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const params: Record<string, string> = {};
  for (const part of q.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  if (!params.state || params.state !== expectedState) return { error: "state_mismatch" };
  if (!params.code || !CODE_RE.test(params.code)) return { error: "bad_code" };
  return { code: params.code };
}
