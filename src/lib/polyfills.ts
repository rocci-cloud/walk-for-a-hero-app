import * as ExpoCrypto from "expo-crypto";

/**
 * Web Crypto for React Native.
 *
 * The Base44 SDK tags every request with a uuid (its axios request
 * interceptor calls uuid v4), and uuid needs `crypto.getRandomValues`.
 * Hermes has no `crypto` global and Expo doesn't add one, so without this
 * EVERY Base44 call throws before it is sent: email sign-in shows "couldn't
 * reach Walk For A Hero" and Google sign-in fails at the final step.
 *
 * expo-crypto is already in the native build, so this ships over the air.
 * It must be imported before anything that loads the SDK (see index.ts).
 */
const g = globalThis as any;
if (typeof g.crypto !== "object" || g.crypto === null) g.crypto = {};
if (typeof g.crypto.getRandomValues !== "function") {
  g.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T =>
    ExpoCrypto.getRandomValues(array as any) as T;
}
if (typeof g.crypto.randomUUID !== "function") {
  g.crypto.randomUUID = () => ExpoCrypto.randomUUID();
}
