import { compressImage } from "../lib/compress-image";
import { supabase } from "../lib/supabase";

const BUCKET = "dish-images";

/** Public address of a dish photo (the bucket is public; file names are random). */
export function dishImageUrl(path: string | null): string | null {
  return path
    ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    : null;
}

/**
 * Compress a photo on the phone (1200 px + 400 px thumbnail) and upload both.
 * Returns the new paths, or null when it failed.
 */
export async function uploadDishPhoto(
  restaurantId: string,
  itemId: string,
  file: Blob,
): Promise<{ image_path: string; image_thumb_path: string } | null> {
  try {
    const [large, thumb] = await Promise.all([
      compressImage(file, 1200, 0.82),
      compressImage(file, 400, 0.8),
    ]);
    const base = `${restaurantId}/${itemId}/${crypto.randomUUID()}`;
    const paths = {
      image_path: `${base}.jpg`,
      image_thumb_path: `${base}_thumb.jpg`,
    };
    const bucket = supabase.storage.from(BUCKET);
    const results = await Promise.all([
      bucket.upload(paths.image_path, large, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
      }),
      bucket.upload(paths.image_thumb_path, thumb, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
      }),
    ]);
    if (results.some((r) => r.error)) return null;
    return paths;
  } catch {
    return null;
  }
}

/** Remove old photo files (best effort: a leftover file only costs a little storage). */
export async function removeDishPhotoFiles(paths: (string | null)[]) {
  const existing = paths.filter((p): p is string => !!p);
  if (existing.length) await supabase.storage.from(BUCKET).remove(existing);
}
