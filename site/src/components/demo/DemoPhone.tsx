// Interactive sample guest menu (CLAUDE.md 4.6, Demo A). Self-contained: hard-coded sample data,
// no network. Behaves like the real guest page will: original dish names first, helper translation
// underneath, confirmed allergens only, cart + "Show to staff", chat answers with item cards.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from "react";
import {
  Info,
  Leaf,
  MessageCircle,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  allItems,
  allergenNames,
  guestLanguageNames,
  guestLanguages,
  guestUi,
  sampleAnswers,
  sampleMenu,
  sampleRestaurant,
  unconfirmedAllergenLine,
  type GuestLang,
  type SampleItem,
} from "../../data/sample-menu";
import { guestPrice } from "../phone/format";

type Cart = Record<string, { qty: number; note: string }>;
type Screen = "menu" | "order" | "staff" | "chat";
type ChatMessage =
  | { from: "guest"; answerId?: string | undefined; text?: string | undefined }
  | { from: "assistant"; answerId?: string | undefined };

export interface DemoPhoneProps {
  /** Accessible name for the demo region (site language). */
  label: string;
  initialLang?: GuestLang;
  /** Full-screen page instead of inside a phone frame. */
  fullscreen?: boolean;
}

const fill = (template: string, dish: string) =>
  template.replace("{dish}", dish);

function itemName(item: SampleItem, lang: GuestLang) {
  return lang === "nl" ? null : item.tr[lang].name;
}
function itemDescription(item: SampleItem, lang: GuestLang) {
  return lang === "nl" ? item.description : item.tr[lang].description;
}

export default function DemoPhone({
  label,
  initialLang = "en",
  fullscreen = false,
}: DemoPhoneProps) {
  const [lang, setLang] = useState<GuestLang>(initialLang);
  const [vegOnly, setVegOnly] = useState(false);
  const [cart, setCart] = useState<Cart>({});
  const [screen, setScreen] = useState<Screen>("menu");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const ui = guestUi[lang];

  const count = Object.values(cart).reduce((n, l) => n + l.qty, 0);
  const total = Object.entries(cart).reduce(
    (sum, [id, l]) =>
      sum + l.qty * (allItems.find((i) => i.id === id)?.price ?? 0),
    0,
  );

  const change = (id: string, delta: number) =>
    setCart((c) => {
      const qty = (c[id]?.qty ?? 0) + delta;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = { qty, note: c[id]?.note ?? "" };
      return next;
    });
  const setNote = (id: string, note: string) =>
    setCart((c) => (c[id] ? { ...c, [id]: { ...c[id], note } } : c));

  const ask = (answerId?: string, text?: string) =>
    setMessages((m) => [
      ...m,
      { from: "guest", answerId, text },
      { from: "assistant", answerId },
    ]);

  return (
    <div
      role="region"
      aria-label={label}
      lang={lang}
      className={`bg-oat-50 text-ink relative flex h-full flex-col overflow-hidden ${
        fullscreen ? "text-[16px]" : "text-[13px]"
      }`}
    >
      <header
        className={`bg-herb-800 text-herb-50 px-4 pb-3 ${
          fullscreen ? "pt-4" : "pt-8"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-[1.3em] leading-tight font-semibold">
              {sampleRestaurant.name}
            </p>
            <p className="text-herb-100 text-[0.85em]">
              {sampleRestaurant.city} · {ui.table} {sampleRestaurant.table}
            </p>
          </div>
          <label className="shrink-0">
            <span className="sr-only">{ui.language}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as GuestLang)}
              className="border-herb-50/30 bg-herb-50/15 text-herb-50 rounded-full border px-2.5 py-1 text-[0.85em] font-semibold"
            >
              {guestLanguages.map((l) => (
                <option key={l} value={l} className="text-ink">
                  {guestLanguageNames[l]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          {[
            { on: !vegOnly, label: ui.all, set: false },
            { on: vegOnly, label: ui.vegetarian, set: true },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              aria-pressed={chip.on}
              onClick={() => setVegOnly(chip.set)}
              className={`flex min-h-8 items-center gap-1 rounded-full px-3 text-[0.85em] font-semibold ${
                chip.on
                  ? "bg-herb-50 text-herb-800"
                  : "bg-herb-50/15 text-herb-50"
              }`}
            >
              {chip.set && <Leaf className="size-[1.1em]" aria-hidden="true" />}
              {chip.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 pt-4 pb-24">
        {sampleMenu.map((category) => {
          const items = category.items.filter((i) => !vegOnly || i.vegetarian);
          if (items.length === 0) return null;
          return (
            <section key={category.name} aria-label={category.name}>
              <h3 className="font-display text-[1.15em] font-semibold">
                {lang === "nl" ? category.name : category.tr[lang]}
              </h3>
              {lang !== "nl" && (
                <p className="text-ink-muted text-[0.8em]">{category.name}</p>
              )}
              <ul className="mt-2 space-y-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <DishCard
                      item={item}
                      lang={lang}
                      qty={cart[item.id]?.qty ?? 0}
                      onChange={(d) => change(item.id, d)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <p className="text-ink-muted flex gap-1.5 px-1 text-[0.8em]">
          <Info className="mt-0.5 size-[1.1em] shrink-0" aria-hidden="true" />
          {ui.allergyNote}
        </p>
      </div>

      <div
        className={`border-line bg-surface/95 absolute inset-x-0 bottom-0 flex gap-2 border-t px-3 pt-2.5 backdrop-blur ${
          fullscreen ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "pb-3"
        }`}
      >
        {count > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setScreen("order")}
              className="bg-herb-700 flex min-h-11 flex-1 items-center gap-2 rounded-full px-4 font-semibold text-white"
            >
              <ShoppingBag className="size-[1.2em]" aria-hidden="true" />
              <span className="text-herb-800 grid min-w-6 place-items-center rounded-full bg-white px-1.5 text-[0.85em]">
                {count}
              </span>
              <span className="flex-1 text-left">{ui.viewOrder}</span>
              <span>{guestPrice(lang, total)}</span>
            </button>
            <button
              type="button"
              onClick={() => setScreen("chat")}
              aria-label={ui.ask}
              className="bg-oat-100 text-herb-800 grid size-11 place-items-center rounded-full"
            >
              <MessageCircle className="size-[1.3em]" aria-hidden="true" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setScreen("chat")}
            className="bg-oat-100 text-ink-muted flex min-h-11 flex-1 items-center gap-2 rounded-full px-4"
          >
            <MessageCircle
              className="text-herb-700 size-[1.2em]"
              aria-hidden="true"
            />
            {ui.ask}
          </button>
        )}
      </div>

      {screen === "order" && (
        <Sheet
          title={ui.yourOrder}
          closeLabel={ui.close}
          onClose={() => setScreen("menu")}
        >
          {count === 0 ? (
            <p className="text-ink-muted px-4 py-8 text-center">
              {ui.emptyOrder}
            </p>
          ) : (
            <ul className="divide-line divide-y overflow-y-auto px-4">
              {Object.entries(cart).map(([id, line]) => {
                const item = allItems.find((i) => i.id === id)!;
                return (
                  <li key={id} className="space-y-2 py-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[1.05em] font-semibold">
                          {item.name}
                        </p>
                        {itemName(item, lang) && (
                          <p className="text-ink-muted text-[0.8em]">
                            {itemName(item, lang)}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold">
                        {guestPrice(lang, line.qty * item.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Stepper
                        qty={line.qty}
                        dish={item.name}
                        lang={lang}
                        onChange={(d) => change(id, d)}
                      />
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">{ui.notePlaceholder}</span>
                        <input
                          id={`demo-note-${id}`}
                          value={line.note}
                          onChange={(e) => setNote(id, e.target.value)}
                          placeholder={ui.notePlaceholder}
                          maxLength={60}
                          className="border-line bg-oat-50 w-full rounded-lg border px-2.5 py-1.5 text-[0.9em]"
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-line mt-auto border-t px-4 pt-3 pb-4">
            <div className="mb-3 flex justify-between font-semibold">
              <span>{ui.total}</span>
              <span>{guestPrice(lang, total)}</span>
            </div>
            <button
              type="button"
              disabled={count === 0}
              onClick={() => setScreen("staff")}
              className="bg-herb-700 min-h-11 w-full rounded-full font-semibold text-white disabled:opacity-50"
            >
              {ui.showToStaff}
            </button>
          </div>
        </Sheet>
      )}

      {screen === "staff" && (
        <StaffView
          cart={cart}
          total={total}
          lang={lang}
          onClose={() => setScreen("order")}
        />
      )}

      {screen === "chat" && (
        <Sheet
          title={ui.askTitle}
          closeLabel={ui.close}
          onClose={() => setScreen("menu")}
          tall
        >
          <ChatView
            lang={lang}
            messages={messages}
            onAsk={ask}
            cart={cart}
            onChange={change}
          />
        </Sheet>
      )}
    </div>
  );
}

function DishCard({
  item,
  lang,
  qty,
  onChange,
}: {
  item: SampleItem;
  lang: GuestLang;
  qty: number;
  onChange: (delta: number) => void;
}) {
  const ui = guestUi[lang];
  const out = item.inStock === false;
  const helper = itemName(item, lang);
  return (
    <article
      className={`rounded-xl p-3 ${out ? "bg-oat-100" : "bg-surface shadow-sm"}`}
      aria-label={item.name}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`font-display text-[1.08em] leading-snug font-semibold ${
              out ? "text-ink-muted" : ""
            }`}
          >
            {item.name}
          </p>
          {helper && <p className="text-ink-muted text-[0.85em]">{helper}</p>}
        </div>
        <p
          className={`font-semibold ${out ? "text-ink-muted line-through" : ""}`}
        >
          {guestPrice(lang, item.price)}
        </p>
      </div>
      <p className="text-ink-muted mt-1.5 text-[0.85em]">
        {itemDescription(item, lang)}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0 space-y-1 text-[0.77em]">
          {item.vegetarian && (
            <span className="bg-herb-100 text-herb-800 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
              <Leaf className="size-[1.1em]" aria-hidden="true" />
              {ui.vegetarian}
            </span>
          )}
          {item.allergens ? (
            <p className="text-ink-muted">
              {ui.allergens}:{" "}
              {item.allergens.map((a) => allergenNames[lang][a]).join(", ")}
            </p>
          ) : (
            <p className="text-mustard-800 flex gap-1 font-medium">
              <Info
                className="mt-px size-[1.1em] shrink-0"
                aria-hidden="true"
              />
              {ui.allergenUnconfirmed}
            </p>
          )}
        </div>
        {out ? (
          <span className="bg-oat-200 text-oat-800 shrink-0 rounded-full px-2 py-1 text-[0.77em] font-semibold">
            {ui.outOfStock}
          </span>
        ) : qty === 0 ? (
          <button
            type="button"
            onClick={() => onChange(1)}
            aria-label={fill(ui.add, item.name)}
            className="bg-herb-700 grid size-9 shrink-0 place-items-center rounded-full text-white"
          >
            <Plus className="size-[1.3em]" aria-hidden="true" />
          </button>
        ) : (
          <Stepper qty={qty} dish={item.name} lang={lang} onChange={onChange} />
        )}
      </div>
    </article>
  );
}

function Stepper({
  qty,
  dish,
  lang,
  onChange,
}: {
  qty: number;
  dish: string;
  lang: GuestLang;
  onChange: (delta: number) => void;
}) {
  const ui = guestUi[lang];
  return (
    <div className="bg-herb-50 text-herb-800 flex shrink-0 items-center rounded-full">
      <button
        type="button"
        onClick={() => onChange(-1)}
        aria-label={fill(ui.decrease, dish)}
        className="grid size-9 place-items-center rounded-full"
      >
        <Minus className="size-[1.2em]" aria-hidden="true" />
      </button>
      <span className="min-w-5 text-center font-semibold" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label={fill(ui.increase, dish)}
        className="bg-herb-700 grid size-9 place-items-center rounded-full text-white"
      >
        <Plus className="size-[1.2em]" aria-hidden="true" />
      </button>
    </div>
  );
}

function Sheet({
  title,
  closeLabel,
  onClose,
  tall = false,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  tall?: boolean;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  return (
    <div
      className="bg-oat-950/50 absolute inset-0 z-20 flex flex-col justify-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-surface flex flex-col rounded-t-2xl pb-[env(safe-area-inset-bottom)] ${
          tall ? "h-[88%]" : "max-h-[85%]"
        }`}
      >
        <div className="border-line flex items-center justify-between border-b py-2 pr-2 pl-4">
          <h3 className="font-display text-[1.15em] font-semibold">{title}</h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="text-ink-muted grid size-10 place-items-center rounded-full"
          >
            <X className="size-[1.3em]" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StaffView({
  cart,
  total,
  lang,
  onClose,
}: {
  cart: Cart;
  total: number;
  lang: GuestLang;
  onClose: () => void;
}) {
  const ui = guestUi[lang];
  const closeRef = useRef<HTMLButtonElement>(null);

  // Keep the screen awake while it is held up to the waiter (CLAUDE.md 4.3); fine if refused.
  useEffect(() => {
    closeRef.current?.focus();
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ui.showToStaff}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="bg-oat-950 absolute inset-0 z-30 flex flex-col overflow-y-auto px-5 pt-9 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={ui.close}
        className="absolute top-7 right-3 grid size-11 place-items-center rounded-full bg-white/10"
      >
        <X className="size-[1.4em]" aria-hidden="true" />
      </button>
      <p className="text-mustard-300 text-[0.85em] font-semibold tracking-wide uppercase">
        {ui.staffHint}
      </p>
      <p className="font-display text-[2.4em] leading-tight font-semibold">
        {ui.table} {sampleRestaurant.table}
      </p>
      <ul className="mt-4 flex-1 space-y-4">
        {Object.entries(cart).map(([id, line]) => {
          const item = allItems.find((i) => i.id === id)!;
          const helper = itemName(item, lang);
          return (
            <li key={id} className="flex gap-3 border-b border-white/15 pb-4">
              <span className="font-display text-mustard-300 text-[2em] leading-none font-semibold">
                {line.qty}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.45em] leading-tight font-semibold">
                  {item.name}
                </p>
                {helper && (
                  <p className="text-oat-300 text-[0.85em]">{helper}</p>
                )}
                {line.note && (
                  <p className="text-mustard-200 mt-1 text-[1em] italic">
                    “{line.note}”
                  </p>
                )}
              </div>
              <span className="font-semibold">
                {guestPrice(lang, line.qty * item.price)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex items-baseline justify-between border-t-2 border-white pt-3">
        <span className="font-semibold uppercase">{ui.total}</span>
        <span className="font-display text-[2em] font-semibold">
          {guestPrice(lang, total)}
        </span>
      </div>
    </div>
  );
}

function ChatView({
  lang,
  messages,
  onAsk,
  cart,
  onChange,
}: {
  lang: GuestLang;
  messages: ChatMessage[];
  onAsk: (answerId?: string, text?: string) => void;
  cart: Cart;
  onChange: (id: string, delta: number) => void;
}) {
  const ui = guestUi[lang];
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => endRef.current?.scrollIntoView({ block: "end" }),
    [messages.length],
  );

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAsk(undefined, text);
  };

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <p className="text-ink-muted text-[0.85em]">{ui.askIntro}</p>
        {messages.map((m, i) =>
          m.from === "guest" ? (
            <p
              key={i}
              className="bg-herb-700 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-white"
            >
              {m.answerId
                ? sampleAnswers.find((a) => a.id === m.answerId)!.question[lang]
                : m.text}
            </p>
          ) : (
            <AssistantMessage
              key={i}
              answerId={m.answerId}
              lang={lang}
              cart={cart}
              onChange={onChange}
            />
          ),
        )}
        <div ref={endRef} />
      </div>
      <div className="border-line border-t px-3 pt-2 pb-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {sampleAnswers.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAsk(a.id)}
              className="border-herb-200 bg-herb-50 text-herb-800 shrink-0 rounded-full border px-3 py-1.5 text-[0.85em] font-medium"
            >
              {a.question[lang]}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{ui.askPlaceholder}</span>
            <input
              id="demo-chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={ui.askPlaceholder}
              maxLength={200}
              className="border-line bg-oat-50 w-full rounded-full border px-3.5 py-2"
            />
          </label>
          <button
            type="submit"
            aria-label={ui.send}
            className="bg-herb-700 grid size-10 shrink-0 place-items-center rounded-full text-white"
          >
            <Send className="size-[1.2em]" aria-hidden="true" />
          </button>
        </form>
      </div>
    </>
  );
}

function AssistantMessage({
  answerId,
  lang,
  cart,
  onChange,
}: {
  answerId: string | undefined;
  lang: GuestLang;
  cart: Cart;
  onChange: (id: string, delta: number) => void;
}) {
  const ui = guestUi[lang];
  const answer = sampleAnswers.find((a) => a.id === answerId);
  const items = useMemo(
    () =>
      (answer?.itemIds ?? []).map((id) => allItems.find((i) => i.id === id)!),
    [answer],
  );
  if (!answer) {
    return (
      <p className="bg-oat-100 w-fit max-w-[90%] rounded-2xl rounded-bl-sm px-3 py-2">
        {ui.demoReply}
      </p>
    );
  }
  const unconfirmed =
    answer.allergenQuestion && items.some((i) => !i.allergens);
  return (
    <div className="max-w-[92%] space-y-2">
      <div className="bg-oat-100 rounded-2xl rounded-bl-sm px-3 py-2">
        <p className="text-ink-muted mb-1 text-[0.75em] font-semibold tracking-wide uppercase">
          {answer.type === "menu_fact" ? ui.fromMenu : ui.general}
        </p>
        <p>{answer.answer[lang]}</p>
        {unconfirmed && (
          <p className="text-mustard-800 mt-2 flex gap-1.5 font-medium">
            <Info className="mt-0.5 size-[1.1em] shrink-0" aria-hidden="true" />
            {unconfirmedAllergenLine[lang]}
          </p>
        )}
      </div>
      {items.map((item) => {
        const out = item.inStock === false;
        const helper = itemName(item, lang);
        const qty = cart[item.id]?.qty ?? 0;
        return (
          <div
            key={item.id}
            className="border-line bg-surface flex items-center gap-2 rounded-xl border p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold">{item.name}</p>
              {helper && (
                <p className="text-ink-muted text-[0.8em]">{helper}</p>
              )}
            </div>
            <span className="text-[0.9em] font-semibold">
              {guestPrice(lang, item.price)}
            </span>
            {out ? (
              <span className="bg-oat-200 text-oat-800 rounded-full px-2 py-1 text-[0.77em] font-semibold">
                {ui.outOfStock}
              </span>
            ) : qty === 0 ? (
              <button
                type="button"
                onClick={() => onChange(item.id, 1)}
                aria-label={fill(ui.add, item.name)}
                className="bg-herb-700 grid size-9 shrink-0 place-items-center rounded-full text-white"
              >
                <Plus className="size-[1.3em]" aria-hidden="true" />
              </button>
            ) : (
              <Stepper
                qty={qty}
                dish={item.name}
                lang={lang}
                onChange={(d) => onChange(item.id, d)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
