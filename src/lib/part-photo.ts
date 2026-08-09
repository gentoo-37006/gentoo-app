import * as ImagePicker from 'expo-image-picker';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';

/**
 * Reference photos for inventory parts.
 *
 * The bucket is PRIVATE, so a stored path is useless on its own — every view
 * mints a short-lived signed URL. Paths (not URLs) live in
 * `inventory_parts.image_path`; persisting a signed URL would bake in an expiry
 * and break the row once it lapsed.
 */

export const PHOTO_BUCKET = 'inventory-photos';

/** Long enough to browse and reopen a part, short enough to stay a capability. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * A 12MP capture is ~5MB raw. Compressing on-device keeps a few hundred parts
 * inside Supabase's free 1GB tier and keeps list thumbnails quick; `allowsEditing`
 * lets people crop to the part instead of the whole workbench.
 */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  quality: 0.6,
};

export type PickedPhoto = { uri: string; mimeType: string };

/** Bucket paths are relative; anything with a scheme is already viewable. */
export function isLocalUri(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function asPicked(result: ImagePicker.ImagePickerResult): PickedPhoto | null {
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
}

export async function pickPhotoFromLibrary(): Promise<PickedPhoto | null> {
  return asPicked(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
}

export async function takePhoto(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission is required to take a photo.');
  return asPicked(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
}

/** `<partId>/<timestamp>.<ext>` — one folder per part, new object per upload. */
export function photoPath(partId: string, mimeType: string, now = Date.now()): string {
  const extension = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  return `${partId}/${now}.${extension}`;
}

/**
 * Upload and return the stored path.
 *
 * Uploads as an ArrayBuffer rather than a browser File: React Native's fetch
 * gives a Blob whose size the Supabase SDK cannot always read, which silently
 * produces a 0-byte object.
 */
export async function uploadPartPhoto(
  partId: string,
  photo: PickedPhoto
): Promise<string> {
  // Demo mode has no session, so storage would 401. Keep the on-device URI as
  // the "path" — signedPhotoUrl passes those straight through, so the demo
  // workspace gets a working photo without touching the bucket.
  if (isDemoMode()) return photo.uri;

  const response = await fetch(photo.uri);
  const bytes = await response.arrayBuffer();
  const path = photoPath(partId, photo.mimeType);

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: photo.mimeType, upsert: true });
  if (error) throw error;
  return path;
}

/** Signed URL for a stored path, or null when the part has no photo. */
export async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  // Demo-mode paths (and anything already absolute) are directly renderable.
  if (isLocalUri(path)) return path;
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null; // a missing object must not break the row
  return data?.signedUrl ?? null;
}

/** Best-effort cleanup; the row is already updated by the time this runs. */
export async function removePartPhoto(path: string | null): Promise<void> {
  if (!path || isLocalUri(path)) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}
