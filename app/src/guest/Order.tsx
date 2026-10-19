// Ordering aid (CLAUDE.md 4.3): + on dishes, a bar at the bottom, the order list and the
// "show to staff" screen. Nothing is sent anywhere; the guest shows the screen to a waiter.
import { useEffect, useRef, useState } from "react";
import { Minus, NotebookPen, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { MAX_QTY, NOTE_MAX, type Cart } from "./cart";
import { helperName, type GuestDish } from "./menu-data";
import type { GuestStrings } from "./strings";

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

/** Lines joined with today's dishes; dishes no longer on the menu are left out. */
export function orderLines(cart: Cart, dishes: Map<string, GuestDish>) {
  return cart.lines.flatMap((line) => {
    const dish = dishes.get(line.id);
    return dish ? [{ ...line, dish }] : [];
  });
}
type OrderLine = ReturnType<typeof orderLines>[number];

function totals(lines: OrderLine[]) {
  const available = lines.filter((l) => l.dish.in_stock);
  return {
    available,
    count: available.reduce((n, l) => n + l.qty, 0),
    total: available.reduce((sum, l) => sum + (l.dish.price ?? 0) * l.qty, 0),
    unpriced: available.some((l) => l.dish.price === null),
  };
}

/** Round + on a dish; shows how many are already in the order. */
export function AddButton({
  dish,
  qty,
  s,
  onAdd,
}: {
  dish: GuestDish;
  qty: number;
  s: GuestStrings;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={qty >= MAX_QTY}
      aria-label={`${s.order.add}: ${dish.name}${qty ? ` (${fill(s.order.inOrder, { count: qty })})` : ""}`}
      className={`relative z-10 grid size-11 shrink-0 place-items-center rounded-full text-base font-bold shadow-sm transition-colors ${
        qty
          ? "bg-brand text-on-brand"
          : "border-brand text-brand-strong bg-surface border-2"
      }`}
    >
      {qty ? qty : <Plus className="size-5" aria-hidden="true" />}
    </button>
  );
}

function Stepper({
  qty,
  s,
  onChange,
  large,
}: {
  qty: number;
  s: GuestStrings;
  onChange: (qty: number) => void;
  large?: boolean;
}) {
  const size = large ? "size-12" : "size-10";
  return (
    <div className="border-line bg-surface inline-flex items-center rounded-full border">
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        aria-label={qty === 1 ? s.order.remove : s.order.decrease}
        className={`grid ${size} place-items-center rounded-full`}
      >
        {qty === 1 ? (
          <Trash2 className="size-4.5" aria-hidden="true" />
        ) : (
          <Minus className="size-4.5" aria-hidden="true" />
        )}
      </button>
      <span
        className={`min-w-7 text-center font-bold tabular-nums ${large ? "text-xl" : "text-lg"}`}
        aria-live="polite"
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= MAX_QTY}
        aria-label={s.order.increase}
        className={`grid ${size} place-items-center rounded-full disabled:opacity-40`}
      >
        <Plus className="size-4.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** "Add to order" at the bottom of the dish sheet, a stepper once it's in. */
export function DetailOrderControl({
  dish,
  cart,
  money,
  s,
}: {
  dish: GuestDish;
  cart: Cart;
  money: Intl.NumberFormat;
  s: GuestStrings;
}) {
  if (!dish.in_stock) return null;
  const qty = cart.qtyOf(dish.id);
  if (!qty)
    return (
      <button
        type="button"
        onClick={() => cart.add(dish.id)}
        className="btn-primary mt-5 w-full"
      >
        <Plus className="size-5" aria-hidden="true" />
        {s.order.addToOrder}
        {dish.price !== null && (
          <span className="tabular-nums">· {money.format(dish.price)}</span>
        )}
      </button>
    );
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <p className="font-semibold">{fill(s.order.inOrder, { count: qty })}</p>
      <Stepper
        qty={qty}
        s={s}
        large
        onChange={(n) => cart.setQty(dish.id, n)}
      />
    </div>
  );
}

/** Bar fixed at the bottom while the order has dishes. */
export function OrderBar({
  lines,
  money,
  s,
  onOpen,
}: {
  lines: OrderLine[];
  money: Intl.NumberFormat;
  s: GuestStrings;
  onOpen: () => void;
}) {
  const all = lines.reduce((n, l) => n + l.qty, 0);
  if (!all) return null;
  const { total } = totals(lines);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onOpen}
        className="bg-brand text-on-brand rounded-control mx-auto flex min-h-14 w-full max-w-2xl items-center gap-3 px-4 font-semibold shadow-lg"
      >
        <span className="relative">
          <ShoppingBag className="size-6" aria-hidden="true" />
          <span className="text-brand-strong absolute -end-2 -top-2 grid min-w-5 place-items-center rounded-full bg-white px-1 text-xs font-bold">
            {all}
          </span>
        </span>
        <span className="flex-1 text-start">{s.order.viewOrder}</span>
        <span className="tabular-nums">{money.format(total)}</span>
      </button>
    </div>
  );
}

/** The order list: quantities, notes, total, and the way to the staff screen. */
export function OrderSheet({
  lines,
  cart,
  money,
  s,
  table,
  onShowStaff,
  onClose,
}: {
  lines: OrderLine[];
  cart: Cart;
  money: Intl.NumberFormat;
  s: GuestStrings;
  table: string | null;
  onShowStaff: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [noteOpen, setNoteOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  // Last dish removed: nothing left to show.
  useEffect(() => {
    if (lines.length === 0) ref.current?.close();
  }, [lines.length]);
  const { available, total, unpriced } = totals(lines);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="order-title"
      className="bg-canvas text-ink m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[1.5rem] p-0 shadow-2xl backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-[1.5rem]"
    >
      <div className="bg-canvas/95 sticky top-0 z-10 flex items-center gap-3 px-5 pt-4 pb-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <h2 id="order-title" className="text-2xl font-semibold">
            {s.order.yourOrder}
          </h2>
          {table && (
            <p className="text-ink-muted text-sm font-medium">
              {fill(s.table, { table })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="bg-surface border-line grid size-11 shrink-0 place-items-center rounded-full border"
          aria-label={s.close}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <ul className="divide-line divide-y px-5">
        {lines.map((line) => {
          const helper = helperName(line.dish);
          const showNote = line.note !== "" || noteOpen.has(line.id);
          return (
            <li
              key={line.id}
              className={`py-4 ${line.dish.in_stock ? "" : "opacity-70"}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-lg leading-snug font-semibold [overflow-wrap:anywhere]"
                    dir="auto"
                  >
                    {line.dish.name}
                  </p>
                  {helper && (
                    <p
                      className="text-ink-muted text-sm font-medium"
                      dir="auto"
                    >
                      {helper}
                    </p>
                  )}
                </div>
                {line.dish.price !== null && line.dish.in_stock && (
                  <p className="shrink-0 text-lg font-semibold tabular-nums">
                    {money.format(line.dish.price * line.qty)}
                  </p>
                )}
              </div>
              {line.dish.in_stock ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <Stepper
                    qty={line.qty}
                    s={s}
                    onChange={(n) => cart.setQty(line.id, n)}
                  />
                  {!showNote && (
                    <button
                      type="button"
                      onClick={() =>
                        setNoteOpen((open) => new Set(open).add(line.id))
                      }
                      className="text-brand-strong inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
                    >
                      <NotebookPen className="size-4" aria-hidden="true" />
                      {s.order.addNote}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="bg-ink-muted text-canvas rounded-full px-2.5 py-0.5 text-xs font-bold">
                    {s.soldOut}
                  </span>
                  <button
                    type="button"
                    onClick={() => cart.setQty(line.id, 0)}
                    className="text-ink inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {s.order.remove}
                  </button>
                </div>
              )}
              {showNote && line.dish.in_stock && (
                <label className="mt-2 block">
                  <span className="sr-only">
                    {s.order.note}: {line.dish.name}
                  </span>
                  <input
                    className="input py-2 text-sm"
                    value={line.note}
                    maxLength={NOTE_MAX}
                    placeholder={s.order.notePlaceholder}
                    autoFocus={line.note === ""}
                    onChange={(e) => cart.setNote(line.id, e.target.value)}
                    dir="auto"
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>

      <div className="bg-canvas/95 border-line sticky bottom-0 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-semibold">{s.order.total}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {money.format(total)}
          </p>
        </div>
        {unpriced && (
          <p className="text-ink-muted text-sm">{s.order.unpriced}</p>
        )}
        <button
          type="button"
          onClick={onShowStaff}
          disabled={available.length === 0}
          className="btn-primary mt-3 w-full text-lg"
        >
          {s.order.showToStaff}
        </button>
        <p className="text-ink-muted mt-2 text-center text-sm">
          {s.order.notSent}
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(s.order.clearConfirm)) cart.clear();
          }}
          className="text-ink-muted mx-auto mt-1 block min-h-11 text-sm font-medium underline underline-offset-2"
        >
          {s.order.clear}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Held up to the waiter: dish names as on the menu (what staff know), big and high-contrast.
 * Labels for staff are in the restaurant's own language; the guest's language only helps.
 */
export function StaffScreen({
  lines,
  money,
  s,
  staff,
  restaurantName,
  table,
  onClose,
}: {
  lines: OrderLine[];
  money: Intl.NumberFormat;
  /** Guest's language. */
  s: GuestStrings;
  /** Restaurant's own language, for the waiter. */
  staff: GuestStrings;
  restaurantName: string;
  table: string | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  // Keep the screen awake while it is shown (released by the browser when the tab hides).
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let closed = false;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (closed) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, []);

  const { available, total, unpriced } = totals(lines);
  const leftOut = available.length < lines.length;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={s.order.showToStaff}
      className="bg-oat-950 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto p-0 text-white backdrop:bg-black"
    >
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-mustard-300 text-sm font-semibold tracking-wide uppercase">
              {s.order.staffHint}
            </p>
            <p className="mt-1 text-lg text-white/80" dir="auto">
              {restaurantName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15"
            aria-label={s.order.back}
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        {table && (
          <p className="font-display mt-3 text-5xl leading-tight font-semibold">
            {fill(staff.table, { table })}
          </p>
        )}

        <ul className="mt-5 flex-1 space-y-5">
          {available.map((line) => {
            const helper = helperName(line.dish);
            return (
              <li
                key={line.id}
                className="flex gap-4 border-b border-white/20 pb-5"
              >
                <span className="font-display text-mustard-300 shrink-0 text-4xl leading-none font-semibold tabular-nums">
                  {line.qty}×
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[1.75rem] leading-tight font-bold break-words"
                    dir="auto"
                  >
                    {line.dish.name}
                  </p>
                  {(helper || line.dish.price !== null) && (
                    <div className="mt-0.5 flex items-baseline justify-between gap-3">
                      <p className="text-base text-white/70" dir="auto">
                        {helper}
                      </p>
                      {line.dish.price !== null && (
                        <p className="shrink-0 text-lg font-semibold tabular-nums">
                          {money.format(line.dish.price * line.qty)}
                        </p>
                      )}
                    </div>
                  )}
                  {line.note && (
                    <p
                      className="bg-mustard-300 text-oat-950 mt-2 inline-block rounded-lg px-2.5 py-1 text-lg font-semibold"
                      dir="auto"
                    >
                      {staff.order.note}: {line.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {leftOut && <p className="mt-4 text-white/70">{s.order.leftOut}</p>}
        <div className="mt-5 flex items-baseline justify-between border-t-2 border-white pt-4">
          <p className="text-2xl font-semibold">{staff.order.total}</p>
          <p className="text-4xl font-bold tabular-nums">
            {money.format(total)}
          </p>
        </div>
        {unpriced && (
          <p className="mt-1 text-sm text-white/70">{s.order.unpriced}</p>
        )}
      </div>
    </dialog>
  );
}
