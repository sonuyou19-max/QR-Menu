import { compressImage } from "../lib/compress-image";
import { supabase } from "../lib/supabase";
import { brandingImage } from "../lib/theme";

const BUCKET = "branding";

/**
 * Logo (PNG, keeps a transparent background, max 600 px) or cover photo (JPEG, 1600 px).
 * Returns the new path, or null when it failed.
 */
export async function uploadBranding(
  restaurantId: string,
  kind: "logo" | "cover",
  file: Blob,
): Promise<string | null> {
  try {
    const png = kind === "logo";
    const blob = png
      ? await compressImage(file, 600, 0.92, "image/png")
      : await compressImage(file, 1600, 0.82);
    const path = `${restaurantId}/${kind}-${crypto.randomUUID()}.${png ? "png" : "jpg"}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: png ? "image/png" : "image/jpeg",
      cacheControl: "31536000",
    });
    return error ? null : path;
  } catch {
    return null;
  }
}

/** Best effort: a leftover file only costs a little storage. */
export async function removeBranding(path: string | null) {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * The main colours of a logo or photo, most used first (skipping near-white, near-black and
 * transparent pixels), so the owner can pick colours that are really theirs.
 */
export async function coloursFrom(path: string): Promise<string[]> {
  const url = brandingImage(path);
  if (!url) return [];
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  try {
    await img.decode();
  } catch {
    return [];
  }
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return []; // image from another origin without CORS
  }
  const buckets = new Map<
    string,
    { n: number; r: number; g: number; b: number }
  >();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
    if (a < 200) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 240 && min > 225) continue; // white
    if (max < 25) continue; // black
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  const colours: string[] = [];
  const counted = [...buckets.values()].reduce((n, b) => n + b.n, 0);
  for (const b of [...buckets.values()].sort((x, y) => y.n - x.n)) {
    // Rare colours are mostly blends at the edges of shapes, not the brand's own.
    if (b.n < Math.max(4, counted * 0.04)) break;
    const c = `#${hex(b.r / b.n)}${hex(b.g / b.n)}${hex(b.b / b.n)}`;
    // Keep colours that look different from the ones already chosen.
    if (colours.every((o) => distance(o, c) > 60)) colours.push(c);
    if (colours.length === 5) break;
  }
  return colours;
}

function distance(a: string, b: string): number {
  const p = (h: string) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!);
}
