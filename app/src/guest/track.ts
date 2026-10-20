// Anonymous guest events for the owner's insights (CLAUDE.md 3 owner flow 11, 4.3): opened the
// menu, changed language, opened a dish, added a dish, showed the order to staff. Only the
// restaurant, the kind, the language, the dish and the table label; nothing about the guest.
// Events are batched and sent with sendBeacon, so leaving the page doesn't lose them.
import { useCallback, useEffect, useRef } from "react";
import { config } from "../lib/config";

export type GuestEventKind =
  "scan" | "view_item" | "language_switch" | "add_to_cart" | "show_to_staff";
interface GuestEvent {
  kind: GuestEventKind;
  language?: string;
  itemId?: string;
  table?: string;
}

const ENDPOINT = `${config.supabaseUrl}/functions/v1/track-event`;
const FLUSH_AFTER_MS = 2000;
const MAX_BATCH = 20;

function send(slug: string, events: GuestEvent[]) {
  const body = JSON.stringify({ slug, events });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, body)) return;
  } catch {
    // Fall back to fetch below.
  }
  void fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(
    () => {},
  );
}

/**
 * Returns track(kind, itemId?, language?). Off for the Look screen's preview frame and for menus that
 * aren't published (the owner checking a draft).
 */
export function useTracker(
  slug: string,
  options: { enabled: boolean; language: string; table: string | null },
) {
  const queue = useRef<GuestEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(options);
  latest.current = options;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    while (queue.current.length) send(slug, queue.current.splice(0, MAX_BATCH));
  }, [slug]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return useCallback(
    /** `language` overrides the shown one (a language switch records the new language). */
    (kind: GuestEventKind, itemId?: string, languageNow?: string) => {
      const { enabled, table } = latest.current;
      const language = languageNow ?? latest.current.language;
      if (!enabled) return;
      queue.current.push({
        kind,
        language,
        ...(itemId ? { itemId } : {}),
        ...(table ? { table } : {}),
      });
      if (queue.current.length >= MAX_BATCH) flush();
      else if (!timer.current)
        timer.current = setTimeout(flush, FLUSH_AFTER_MS);
    },
    [flush],
  );
}

/** A visit counts once per menu per browser session. */
export function firstVisitThisSession(slug: string): boolean {
  const key = `mb.visit.${slug}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    // Without storage every page load counts; still better than nothing.
  }
  return true;
}
