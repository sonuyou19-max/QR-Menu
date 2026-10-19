/**
 * Shrink a phone photo before sending it: max 1600 px on the long side, JPEG (CLAUDE.md 8), as
 * base64 for the demo-translate function. Throws when the browser can't open the file (e.g. HEIC
 * on some Android browsers).
 */
export async function compressPhoto(
  file: Blob,
  maxSide = 1600,
): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (!dataUrl.startsWith("data:image/jpeg;base64,"))
    throw new Error("could not encode image");
  return dataUrl.slice("data:image/jpeg;base64,".length);
}
