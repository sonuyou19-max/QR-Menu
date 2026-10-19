// Limits for texts Buddy (the AI) writes. The owner's own descriptions have no limit.

/** Buddy's "typical preparation" stays short enough to read on a phone. */
export const MAX_BUDDY_WORDS = 25;

/**
 * Keep at most `max` words. Cut at the last sentence or clause break inside the limit when there
 * is one in the second half, so the text still reads as a sentence; otherwise end with "…".
 */
export function limitWords(text: string, max = MAX_BUDDY_WORDS): string {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= max) return trimmed;
  const cut = words.slice(0, max).join(" ");
  const breakAt = Math.max(
    ...[".", "!", "?", ";", ",", ":"].map((c) => cut.lastIndexOf(c)),
  );
  if (breakAt >= cut.length / 2) return `${cut.slice(0, breakAt).trimEnd()}.`;
  return `${cut.replace(/[\s,;:]+$/, "")}…`;
}

/**
 * A short line Buddy writes (the look's tagline): at most `maxWords` words and `maxChars`
 * characters. When the model wrote more, cut at a clause break in the second half; without one,
 * return "" — never half a sentence ("pasta à la").
 */
export function shortLine(text: string, maxWords = 8, maxChars = 60): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const all = words.join(" ");
  if (words.length <= maxWords && all.length <= maxChars) return all;
  let cut = "";
  for (const [i, word] of words.entries()) {
    const next = cut ? `${cut} ${word}` : word;
    if (i >= maxWords || next.length > maxChars) break;
    cut = next;
  }
  const breakAt = Math.max(
    ...[",", ";", ":", "–", "—", "·", "|", ".", "!", "?"].map((c) =>
      cut.lastIndexOf(c),
    ),
  );
  return breakAt >= cut.length / 2 ? cut.slice(0, breakAt).trimEnd() : "";
}
