/**
 * Shrink a phone photo before upload: max 1600 px on the long side, JPEG (CLAUDE.md 8).
 * Big enough for the AI to read small print, small enough for slow mobile data.
 * Throws when the browser can't open the file (e.g. HEIC on some Android browsers).
 */
export async function compressImage(
  file: Blob,
  maxSide = 1600,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("could not encode image");
  return blob;
}
