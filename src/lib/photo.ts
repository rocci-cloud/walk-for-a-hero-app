import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { callFunction, functionError } from "./base44";
import { BASE44_APP_ID, BASE44_SERVER_URL } from "./config";
import { currentToken } from "./session";

/**
 * Walker photo — the same path as the website's src/lib/walkerPhoto.js:
 * square, 800 px, re-encoded as JPEG (which also drops camera metadata such as
 * the GPS location phones embed), uploaded to the app's own Base44 storage,
 * then set through set-walker-photo, which re-checks everything.
 *
 * The upload goes straight to Base44's UploadFile endpoint: the SDK's helper
 * only recognises browser File objects, and a phone has none.
 */

const OUTPUT = 800;

export class PhotoError extends Error {}

export async function pickPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  return res.assets[0].uri;
}

async function prepare(uri: string) {
  const ctx = ImageManipulator.manipulate(uri).resize({ width: OUTPUT, height: OUTPUT });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.88 });
  return out.uri;
}

async function upload(fileUri: string): Promise<string> {
  const token = await currentToken();
  const form = new FormData();
  form.append("file", { uri: fileUri, name: "walker-photo.jpg", type: "image/jpeg" } as any);
  const res = await fetch(`${BASE44_SERVER_URL}/api/apps/${BASE44_APP_ID}/integration-endpoints/Core/UploadFile`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body?.file_url) throw new PhotoError("The photo didn't upload. Please try again.");
  return body.file_url;
}

/** Pick, prepare, upload and set. Resolves to the new photo URL, or null if the walker cancelled. */
export async function changeWalkerPhoto(): Promise<string | null> {
  const picked = await pickPhoto();
  if (!picked) return null;
  let prepared: string;
  try {
    prepared = await prepare(picked);
  } catch {
    throw new PhotoError("We couldn't open that photo. Please choose another.");
  }
  const fileUrl = await upload(prepared);
  try {
    const out: any = await callFunction("set-walker-photo", { action: "set", file_url: fileUrl });
    if (out?.error) throw new PhotoError(out.error);
    return out?.photo_url || fileUrl;
  } catch (e) {
    if (e instanceof PhotoError) throw e;
    throw new PhotoError(functionError(e) || "Something went wrong saving your photo. Please try again.");
  }
}

export async function removeWalkerPhoto() {
  try {
    const out: any = await callFunction("set-walker-photo", { action: "remove" });
    if (out?.error) throw new PhotoError(out.error);
  } catch (e) {
    if (e instanceof PhotoError) throw e;
    throw new PhotoError(functionError(e) || "Something went wrong removing your photo. Please try again.");
  }
}
