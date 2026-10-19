// The guest's order list (CLAUDE.md 4.3): only in this browser, per restaurant, gone after 6 hours.
// Lines hold dish ids only; names and prices always come from the live menu.
import { useCallback, useEffect, useMemo, useState } from "react";

export interface CartLine {
  id: string;
  qty: number;
  note: string;
}

const TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_QTY = 20;
export const NOTE_MAX = 80;

const key = (slug: string) => `mb.cart.${slug}`;

function read(slug: string): CartLine[] {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return [];
    const stored = JSON.parse(raw) as { at?: unknown; lines?: unknown };
    if (
      typeof stored.at !== "number" ||
      Date.now() - stored.at > TTL_MS ||
      !Array.isArray(stored.lines)
    ) {
      localStorage.removeItem(key(slug));
      return [];
    }
    return stored.lines.flatMap((l: Partial<CartLine>) =>
      typeof l?.id === "string" &&
      typeof l.qty === "number" &&
      Number.isInteger(l.qty) &&
      l.qty > 0
        ? [
            {
              id: l.id,
              qty: Math.min(l.qty, MAX_QTY),
              note: typeof l.note === "string" ? l.note.slice(0, NOTE_MAX) : "",
            },
          ]
        : [],
    );
  } catch {
    return [];
  }
}

function write(slug: string, lines: CartLine[]) {
  try {
    if (lines.length === 0) localStorage.removeItem(key(slug));
    else
      localStorage.setItem(
        key(slug),
        JSON.stringify({ at: Date.now(), lines }),
      );
  } catch {
    // Storage blocked (private mode): the order still works until the page closes.
  }
}

export function useCart(slug: string) {
  const [lines, setLines] = useState<CartLine[]>(() => read(slug));

  const update = useCallback(
    (change: (lines: CartLine[]) => CartLine[]) =>
      setLines((current) => {
        const changed = change(current);
        if (changed === current) return current; // nothing changed: keep the 6-hour clock
        const next = changed.filter((l) => l.qty > 0);
        write(slug, next);
        return next;
      }),
    [slug],
  );

  // Back after a while (or from another tab): pick up the stored list, or clear an old one.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setLines(read(slug));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [slug]);

  return useMemo(
    () => ({
      lines,
      qtyOf: (id: string) => lines.find((l) => l.id === id)?.qty ?? 0,
      add: (id: string) =>
        update((ls) =>
          ls.some((l) => l.id === id)
            ? ls.map((l) =>
                l.id === id ? { ...l, qty: Math.min(l.qty + 1, MAX_QTY) } : l,
              )
            : [...ls, { id, qty: 1, note: "" }],
        ),
      setQty: (id: string, qty: number) =>
        update((ls) =>
          ls.map((l) =>
            l.id === id
              ? { ...l, qty: Math.max(0, Math.min(qty, MAX_QTY)) }
              : l,
          ),
        ),
      setNote: (id: string, note: string) =>
        update((ls) =>
          ls.map((l) =>
            l.id === id ? { ...l, note: note.slice(0, NOTE_MAX) } : l,
          ),
        ),
      /** Drop dishes that are no longer on the menu (hidden or deleted). */
      keepOnly: (ids: Set<string>) =>
        update((ls) =>
          ls.every((l) => ids.has(l.id)) ? ls : ls.filter((l) => ids.has(l.id)),
        ),
      clear: () => update(() => []),
    }),
    [lines, update],
  );
}

export type Cart = ReturnType<typeof useCart>;
