// Guest chat (CLAUDE.md 3 guest flow 6, 4.1): questions about this restaurant's menu, answered by
// the menu-chat function. Dish cards are built from the menu the page already loaded (by id), so
// names, prices and stock come from the database, never from the AI's text. Lazy-loaded.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  ArrowUp,
  Info,
  MessageCircle,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Cart } from "./cart";
import { helperName, type GuestDish } from "./menu-data";
import { AddButton } from "./Order";
import type { GuestStrings } from "./strings";

type Notice = "allergens_unconfirmed" | "allergens_off" | null;
interface Message {
  role: "guest" | "assistant";
  text: string;
  dishIds?: string[];
  notice?: Notice;
  /** A local message (error, limit): shown, but not sent back to the AI. */
  local?: boolean;
}

const MAX_QUESTION = 500;

function sessionId(): string {
  const make = () => crypto.randomUUID().replace(/-/g, "");
  try {
    const saved = sessionStorage.getItem("mb.chatSession");
    if (saved) return saved;
    const id = make();
    sessionStorage.setItem("mb.chatSession", id);
    return id;
  } catch {
    return make();
  }
}

const historyKey = (slug: string) => `mb.chat.${slug}`;
function loadHistory(slug: string): Message[] {
  try {
    const raw = sessionStorage.getItem(historyKey(slug));
    return raw ? (JSON.parse(raw) as Message[]).slice(-30) : [];
  } catch {
    return [];
  }
}

export default function Chat({
  slug,
  language,
  s,
  dishes,
  cart,
  money,
  onOpenDish,
  onClose,
  assistantName,
}: {
  slug: string;
  language: string;
  s: GuestStrings;
  dishes: Map<string, GuestDish>;
  cart: Cart;
  money: Intl.NumberFormat;
  onOpenDish: (dish: GuestDish) => void;
  onClose: () => void;
  /** The restaurant's own name for its AI waiter, if it chose one. */
  assistantName?: string | null | undefined;
}) {
  const c = s.chat;
  const ref = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>(() => loadHistory(slug));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        historyKey(slug),
        JSON.stringify(messages.slice(-30)),
      );
    } catch {
      // Not kept after a reload; the chat still works.
    }
    list.current?.scrollTo({
      top: list.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy, slug]);

  const ask = async (question: string) => {
    const text = question.trim().slice(0, MAX_QUESTION);
    if (!text || busy) return;
    const next: Message[] = [...messages, { role: "guest", text }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean;
      answer: string | null;
      dishIds: string[];
      notice: Notice;
    }>("menu-chat", {
      body: {
        slug,
        language,
        sessionId: sessionId(),
        messages: next
          .filter((m) => !m.local)
          .slice(-8)
          .map((m) => ({ role: m.role, text: m.text.slice(0, MAX_QUESTION) })),
      },
    });
    setBusy(false);
    if (error || !data?.ok) {
      const body =
        error instanceof FunctionsHttpError
          ? ((await error.context.json().catch(() => null)) as {
              error?: string;
            } | null)
          : null;
      const text =
        body?.error === "limit"
          ? c.limit
          : body?.error === "busy"
            ? c.busy
            : c.error;
      return setMessages((m) => [
        ...m,
        { role: "assistant", text, local: true },
      ]);
    }
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        text: data.answer ?? c.fallback,
        dishIds: data.dishIds,
        notice: data.notice,
        local: data.answer === null,
      },
    ]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="chat-title"
      className="bg-canvas text-ink m-0 mt-auto flex h-[88dvh] max-h-none w-full max-w-none flex-col overflow-hidden rounded-t-[1.5rem] p-0 shadow-2xl backdrop:bg-black/40 sm:m-auto sm:h-[80dvh] sm:max-w-lg sm:rounded-[1.5rem]"
    >
      <div className="border-line flex items-center gap-3 border-b px-5 pt-4 pb-3">
        <MessageCircle
          className="text-brand-strong size-6 shrink-0"
          aria-hidden="true"
        />
        <h2
          id="chat-title"
          className="min-w-0 flex-1 text-lg leading-tight font-semibold"
        >
          {assistantName ? (
            <>
              <span dir="auto">{assistantName}</span>
              <span className="text-ink-muted block font-sans text-sm font-normal">
                {c.aiLabel}
              </span>
            </>
          ) : (
            c.title
          )}
        </h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="text-ink-muted grid size-11 place-items-center rounded-full"
            aria-label={c.clear}
            title={c.clear}
          >
            <RotateCcw className="size-5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="bg-surface border-line grid size-11 shrink-0 place-items-center rounded-full border"
          aria-label={s.close}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={list}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div>
            <p className="text-ink-muted">
              {assistantName
                ? c.introNamed.replace("{name}", assistantName)
                : c.intro}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[c.s1, c.s2, c.s3].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void ask(q)}
                  className="border-line bg-surface min-h-10 rounded-full border px-3.5 text-start text-sm font-semibold"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "guest" ? (
            <p
              key={i}
              className="bg-brand text-on-brand ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-sm px-3.5 py-2"
              dir="auto"
            >
              {m.text}
            </p>
          ) : (
            <div key={i} className="max-w-[92%] space-y-2">
              <p
                className="bg-surface-muted w-fit rounded-2xl rounded-es-sm px-3.5 py-2"
                dir="auto"
              >
                {m.text}
              </p>
              {m.notice && (
                <p className="text-mustard-800 flex gap-1.5 text-sm font-medium">
                  <ShieldAlert
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  {m.notice === "allergens_off"
                    ? s.allergyFooter
                    : c.unconfirmed}
                </p>
              )}
              {m.dishIds
                ?.map((id) => dishes.get(id))
                .filter((d): d is GuestDish => !!d)
                .map((dish) => (
                  <DishCard
                    key={dish.id}
                    dish={dish}
                    s={s}
                    money={money}
                    qty={cart.qtyOf(dish.id)}
                    onAdd={() => cart.add(dish.id)}
                    onOpen={() => onOpenDish(dish)}
                  />
                ))}
            </div>
          ),
        )}

        {busy && (
          <p className="bg-surface-muted text-ink-muted w-fit animate-pulse rounded-2xl rounded-es-sm px-3.5 py-2">
            {c.thinking}
          </p>
        )}
      </div>

      <form
        onSubmit={submit}
        className="border-line bg-canvas border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{c.placeholder}</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_QUESTION}
              placeholder={c.placeholder}
              enterKeyHint="send"
              className="input rounded-full py-2.5"
              dir="auto"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="bg-brand text-on-brand grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-50"
            aria-label={c.send}
          >
            <ArrowUp className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p className="text-ink-muted mt-2 flex gap-1.5 text-xs">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {c.disclaimer}
        </p>
      </form>
    </dialog>
  );
}

/** A dish the answer mentions: from the menu data, with the real price, stock and +. */
function DishCard({
  dish,
  s,
  money,
  qty,
  onAdd,
  onOpen,
}: {
  dish: GuestDish;
  s: GuestStrings;
  money: Intl.NumberFormat;
  qty: number;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const helper = helperName(dish);
  return (
    <div
      className={`bg-surface border-line rounded-control relative flex items-center gap-3 border p-3 ${dish.in_stock ? "" : "opacity-70"}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-start after:absolute after:inset-0 after:content-['']"
      >
        <span className="block leading-snug font-semibold" dir="auto">
          {dish.name}
        </span>
        {helper && (
          <span className="text-ink-muted block text-sm" dir="auto">
            {helper}
          </span>
        )}
        <span className="mt-0.5 flex items-center gap-2 text-sm">
          {dish.price !== null && (
            <span className="font-semibold tabular-nums">
              {money.format(dish.price)}
            </span>
          )}
          {!dish.in_stock && (
            <span className="bg-ink-muted text-canvas rounded-full px-2 py-0.5 text-xs font-bold">
              {s.soldOut}
            </span>
          )}
        </span>
      </button>
      {dish.in_stock && <AddButton dish={dish} qty={qty} s={s} onAdd={onAdd} />}
    </div>
  );
}
