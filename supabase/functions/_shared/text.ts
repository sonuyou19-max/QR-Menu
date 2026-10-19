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
