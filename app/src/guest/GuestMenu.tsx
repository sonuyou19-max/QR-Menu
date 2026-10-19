import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Info,
  LoaderCircle,
  MessageCircleQuestion,
  ShieldAlert,
  X,
} from "lucide-react";
import { config } from "../lib/config";
import type { Allergen } from "../lib/extraction";
import { supabase } from "../lib/supabase";
import { rtlLanguages, stringsFor, type GuestStrings } from "./strings";

export interface GuestDish {
  id: string;
  name: string;
  translated_name: string | null;
  price: number | null;
  description: string | null;
  description_is_typical: boolean;
  confidence: "known_dish" | "likely" | "unknown" | null;
  dietary: Partial<
    Record<
      | "vegetarian"
      | "vegan"
      | "contains_pork"
      | "contains_beef"
      | "contains_alcohol"
      | "spicy",
      boolean
    >
  >;
  /** Only when the restaurant shows allergens and the owner confirmed them. */
  allergens: Allergen[] | null;
  /** null when the restaurant doesn't show allergens at all. */
  allergens_confirmed: boolean | null;
  image_path: string | null;
  thumb_path: string | null;
  in_stock: boolean;
}

export interface GuestMenuData {
  restaurant: {
    name: string;
    slug: string;
    currency: string;
    source_language: string;
    languages: string[];
    language: string;
    show_allergens: boolean;
    is_published: boolean;
  };
  categories: {
    id: string;
    name: string;
    translated_name: string | null;
    items: GuestDish[];
  }[];
}

type Filter = "vegetarian" | "vegan" | "noPork" | "noBeef" | "glutenFree";
const LANG_KEY = "mb.guestLang";

/** Guest's language wishes, best first: their earlier pick, then the phone's languages. */
function wishedLanguages(): string[] {
  const wishes: string[] = [];
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved) wishes.push(saved);
  } catch {
    // Storage blocked: just use the phone's languages.
  }
  for (const l of navigator.languages ?? [navigator.language])
    wishes.push(l.slice(0, 2).toLowerCase());
  return wishes;
}

function pickLanguage(available: string[], source: string): string {
  return (
    wishedLanguages().find((l) => available.includes(l)) ??
    (available.includes("en") ? "en" : source)
  );
}

/** Hide helper lines that only differ in spacing or punctuation ("Saag/ Kadai" vs "Saag/Kadai"). */
const plain = (s: string) => s.toLowerCase().replace(/[\s\p{P}]/gu, "");
function helperName(dish: { name: string; translated_name: string | null }) {
  return dish.translated_name &&
    plain(dish.translated_name) !== plain(dish.name)
    ? dish.translated_name
    : null;
}

export const dishImage = (path: string | null) =>
  path
    ? `${config.supabaseUrl}/storage/v1/object/public/dish-images/${path}`
    : null;

function matches(dish: GuestDish, filters: Set<Filter>): boolean {
  for (const f of filters) {
    if (f === "vegetarian" && !(dish.dietary.vegetarian || dish.dietary.vegan))
      return false;
    if (f === "vegan" && !dish.dietary.vegan) return false;
    if (f === "noPork" && dish.dietary.contains_pork) return false;
    if (f === "noBeef" && dish.dietary.contains_beef) return false;
    // Only dishes whose allergens the owner confirmed can be called gluten-free.
    if (
      f === "glutenFree" &&
      !(dish.allergens_confirmed && !dish.allergens?.includes("gluten"))
    )
      return false;
  }
  return true;
}

/** Table label from a per-table QR code (?t=5), kept for the "show to staff" screen. */
function tableLabel(slug: string): string | null {
  const t = new URLSearchParams(location.search).get("t");
  const valid = t && /^[\p{L}\p{N} _-]{1,20}$/u.test(t) ? t : null;
  const key = `mb.table.${slug}`;
  try {
    if (valid) sessionStorage.setItem(key, valid);
    return sessionStorage.getItem(key);
  } catch {
    return valid;
  }
}

/** The guest menu at /m/:slug (CLAUDE.md 3, 4). Public, no login, no cookies. */
export function GuestMenu({ slug }: { slug: string }) {
  const [menu, setMenu] = useState<GuestMenuData | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [language, setLanguage] = useState<string>(
    () => wishedLanguages()[0] ?? "en",
  );
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [openDish, setOpenDish] = useState<GuestDish | null>(null);
  const table = useMemo(() => tableLabel(slug), [slug]);
  const requested = useRef(language);
  // The first answer tells which languages exist; pick the best one once, then follow the guest.
  const autoPicked = useRef(false);

  const load = useCallback(
    async (lang: string) => {
      requested.current = lang;
      const { data, error } = await supabase.rpc("get_menu", {
        p_slug: slug,
        p_language: lang,
      });
      if (requested.current !== lang) return; // a newer language was picked meanwhile
      if (error) return setFailed(true);
      setFailed(false);
      const result = data as unknown as GuestMenuData | null;
      if (result && !autoPicked.current) {
        autoPicked.current = true;
        const best = pickLanguage(
          result.restaurant.languages,
          result.restaurant.source_language,
        );
        if (best !== result.restaurant.language) return setLanguage(best);
      }
      setMenu(result);
    },
    [slug],
  );

  useEffect(() => {
    void load(language);
  }, [load, language]);

  // Live: sold out, price and visibility changes; a phone that slept reloads when it wakes.
  useEffect(() => {
    const channel = supabase
      .channel(`menu:${slug}`)
      .on("broadcast", { event: "item" }, ({ payload }) => {
        const change = payload as {
          id: string;
          in_stock: boolean;
          price: number | null;
          is_hidden: boolean;
        };
        if (change.is_hidden) return void load(requested.current);
        setMenu((current) => {
          if (!current) return current;
          let found = false;
          const categories = current.categories.map((c) => ({
            ...c,
            items: c.items.map((d) => {
              if (d.id !== change.id) return d;
              found = true;
              return { ...d, in_stock: change.in_stock, price: change.price };
            }),
          }));
          if (!found) void load(requested.current); // a dish that was hidden came back
          return { ...current, categories };
        });
        setOpenDish((d) =>
          d?.id === change.id
            ? { ...d, in_stock: change.in_stock, price: change.price }
            : d,
        );
      })
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(requested.current);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [slug, load]);

  const shownLanguage = menu?.restaurant.language ?? language;
  const s = stringsFor(shownLanguage);
  useEffect(() => {
    document.documentElement.lang = shownLanguage;
    document.documentElement.dir = rtlLanguages.has(shownLanguage)
      ? "rtl"
      : "ltr";
    if (menu) document.title = menu.restaurant.name;
  }, [shownLanguage, menu]);

  if (menu === undefined && !failed)
    return (
      <div className="grid min-h-dvh place-items-center">
        <LoaderCircle
          className="text-brand size-8 animate-spin"
          aria-label="…"
        />
      </div>
    );
  if (failed && !menu)
    return (
      <Message title={s.loadError}>
        <button
          type="button"
          onClick={() => void load(language)}
          className="btn-primary mt-5"
        >
          {s.retry}
        </button>
      </Message>
    );
  if (!menu) return <Message title={s.notFoundTitle}>{s.notFoundText}</Message>;

  const { restaurant } = menu;
  const money = new Intl.NumberFormat(shownLanguage, {
    style: "currency",
    currency: restaurant.currency,
  });
  const filterKeys: Filter[] = [
    "vegetarian",
    "vegan",
    "noPork",
    "noBeef",
    ...(restaurant.show_allergens ? (["glutenFree"] as const) : []),
  ];
  const categories = menu.categories
    .map((c) => ({ ...c, items: c.items.filter((d) => matches(d, filters)) }))
    .filter((c) => c.items.length > 0);

  const changeLanguage = (lang: string) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // Not remembered; it still applies now.
    }
    setLanguage(lang);
  };

  const toggleFilter = (f: Filter) =>
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  return (
    <div className="bg-canvas min-h-dvh">
      {!restaurant.is_published && (
        <p className="bg-mustard-100 text-mustard-900 px-4 py-2 text-center text-sm font-semibold">
          {s.preview}
        </p>
      )}

      <header className="bg-canvas/95 border-line sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold" dir="auto">
              {restaurant.name}
            </h1>
            {table && (
              <p className="text-ink-muted text-sm font-medium">
                {s.table.replace("{table}", table)}
              </p>
            )}
          </div>
          {restaurant.languages.length > 1 && (
            <label className="shrink-0">
              <span className="sr-only">{s.language}</span>
              <select
                value={shownLanguage}
                onChange={(e) => changeLanguage(e.target.value)}
                className="border-line bg-surface rounded-full border py-2 ps-3 pe-8 text-sm font-semibold"
              >
                {restaurant.languages.map((code) => (
                  <option key={code} value={code}>
                    {nativeName(code)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <nav aria-label={s.categories} className="mx-auto max-w-2xl">
          <ul className="flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-2.5">
            {categories.map((c) => (
              <li key={c.id} className="shrink-0">
                <a
                  href={`#cat-${c.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(`cat-${c.id}`)
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-oat-100 text-ink inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap"
                  dir="auto"
                >
                  {c.translated_name &&
                  plain(c.translated_name) !== plain(c.name)
                    ? c.translated_name
                    : c.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16">
        <div
          role="group"
          aria-label={s.filters}
          className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pt-4 pb-1"
        >
          {filterKeys.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filters.has(f)}
              onClick={() => toggleFilter(f)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${
                filters.has(f)
                  ? "border-herb-700 bg-herb-50 text-herb-800"
                  : "border-line bg-surface text-ink"
              }`}
            >
              {filters.has(f) && (
                <Check className="size-4" aria-hidden="true" />
              )}
              {s[f]}
            </button>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="mt-10 text-center">
            <p className="text-ink-muted">{s.noMatches}</p>
            <button
              type="button"
              onClick={() => setFilters(new Set())}
              className="btn-secondary mt-4"
            >
              {s.showAll}
            </button>
          </div>
        )}

        {categories.map((c) => {
          const translated =
            c.translated_name && plain(c.translated_name) !== plain(c.name)
              ? c.translated_name
              : null;
          return (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              aria-labelledby={`h-${c.id}`}
              className="scroll-mt-32 pt-7"
            >
              <h2 id={`h-${c.id}`} className="text-2xl font-semibold">
                <span dir="auto">{translated ?? c.name}</span>
                {translated && (
                  <span
                    className="text-ink-muted block font-sans text-sm font-medium"
                    dir="auto"
                  >
                    {c.name}
                  </span>
                )}
              </h2>
              <ul className="divide-line mt-2 divide-y">
                {c.items.map((dish) => (
                  <li key={dish.id}>
                    <DishCard
                      dish={dish}
                      money={money}
                      s={s}
                      onOpen={() => setOpenDish(dish)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <footer className="text-ink-muted mt-12 space-y-2 text-center text-sm">
          <p className="text-ink flex items-center justify-center gap-2 font-semibold">
            <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
            {s.allergyFooter}
          </p>
          <p>{s.privacy}</p>
          <p>{s.poweredBy}</p>
        </footer>
      </main>

      {openDish && (
        <DishDetail
          dish={openDish}
          money={money}
          s={s}
          onClose={() => setOpenDish(null)}
        />
      )}
    </div>
  );
}

function nativeName(code: string): string {
  try {
    const name =
      new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code.toUpperCase();
  }
}

function Message({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="bg-canvas grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children && <div className="text-ink-muted mt-2">{children}</div>}
      </div>
    </main>
  );
}

function Tags({ dish, s }: { dish: GuestDish; s: GuestStrings }) {
  const tags = [
    dish.dietary.vegan
      ? s.vegan
      : dish.dietary.vegetarian
        ? s.vegetarian
        : null,
    dish.dietary.spicy ? s.spicy : null,
    dish.dietary.contains_alcohol ? s.alcohol : null,
  ].filter((t): t is string => !!t);
  if (!tags.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li
          key={tag}
          className="bg-herb-50 text-herb-800 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

function AllergenLine({ dish, s }: { dish: GuestDish; s: GuestStrings }) {
  if (dish.allergens_confirmed === null) return null; // restaurant doesn't show allergens
  if (!dish.allergens_confirmed)
    return (
      <p className="text-mustard-800 mt-1.5 text-xs font-medium">
        {s.allergensUnconfirmed}
      </p>
    );
  return (
    <p className="text-ink-muted mt-1.5 text-xs">
      <span className="font-semibold">{s.allergens}:</span>{" "}
      {dish.allergens?.length
        ? dish.allergens.map((a) => s.allergenNames[a] ?? a).join(", ")
        : s.noAllergens}
    </p>
  );
}

function Description({
  dish,
  s,
  clamp,
}: {
  dish: GuestDish;
  s: GuestStrings;
  clamp?: boolean;
}) {
  if (!dish.description)
    return dish.confidence === "unknown" ? (
      <p className="text-ink-muted mt-1 flex gap-1.5 text-sm">
        <MessageCircleQuestion
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        {s.askStaff}
      </p>
    ) : null;
  return (
    <p
      className={`text-ink-muted mt-1 text-sm ${clamp ? "line-clamp-3" : ""} ${dish.description_is_typical ? "italic" : ""}`}
      dir="auto"
    >
      {dish.description_is_typical && (
        <span className="not-italic">
          <Info
            className="me-1 inline size-3.5 align-[-2px]"
            aria-hidden="true"
          />
          <span className="sr-only">{s.typical}: </span>
        </span>
      )}
      {dish.description}
    </p>
  );
}

function DishCard({
  dish,
  money,
  s,
  onOpen,
}: {
  dish: GuestDish;
  money: Intl.NumberFormat;
  s: GuestStrings;
  onOpen: () => void;
}) {
  const thumb = dishImage(dish.thumb_path ?? dish.image_path);
  const helper = helperName(dish);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full gap-3 py-4 text-start ${dish.in_stock ? "" : "opacity-60"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <p
            className="min-w-0 flex-1 text-lg leading-snug font-semibold [overflow-wrap:anywhere]"
            dir="auto"
          >
            {dish.name}
          </p>
          {dish.price !== null && (
            <p className="shrink-0 text-lg font-semibold tabular-nums">
              {money.format(dish.price)}
            </p>
          )}
        </div>
        {helper && (
          <p className="text-ink-muted text-sm font-medium" dir="auto">
            {helper}
          </p>
        )}
        {!dish.in_stock && (
          <p className="bg-oat-600 mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold text-white">
            {s.soldOut}
          </p>
        )}
        <Description dish={dish} s={s} clamp />
        <Tags dish={dish} s={s} />
        <AllergenLine dish={dish} s={s} />
      </div>
      {thumb && (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="rounded-control size-20 shrink-0 object-cover sm:size-24"
        />
      )}
    </button>
  );
}

function DishDetail({
  dish,
  money,
  s,
  onClose,
}: {
  dish: GuestDish;
  money: Intl.NumberFormat;
  s: GuestStrings;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const photo = dishImage(dish.image_path);
  const helper = helperName(dish);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dish-title"
      className="bg-canvas text-ink m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-[1.5rem] p-0 shadow-2xl backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-[1.5rem]"
    >
      <div className="relative">
        {photo && (
          <img
            src={photo}
            alt=""
            className="aspect-[4/3] w-full object-cover"
          />
        )}
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="bg-surface/90 absolute end-3 top-3 grid size-11 place-items-center rounded-full shadow"
          aria-label={s.close}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div
        className={`px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${photo ? "pt-4" : "pt-14"}`}
      >
        <div className="flex items-start gap-3">
          <h2
            id="dish-title"
            className="min-w-0 flex-1 text-2xl font-semibold"
            dir="auto"
          >
            {dish.name}
          </h2>
          {dish.price !== null && (
            <p className="shrink-0 text-xl font-semibold tabular-nums">
              {money.format(dish.price)}
            </p>
          )}
        </div>
        {helper && (
          <p className="text-ink-muted font-medium" dir="auto">
            {helper}
          </p>
        )}
        {!dish.in_stock && (
          <p className="bg-oat-600 mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold text-white">
            {s.soldOut}
          </p>
        )}
        {dish.description_is_typical && dish.description && (
          <p className="text-ink-muted mt-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <Info className="size-3.5" aria-hidden="true" />
            {s.typical}
          </p>
        )}
        <Description dish={dish} s={s} />
        <Tags dish={dish} s={s} />
        <AllergenLine dish={dish} s={s} />
      </div>
    </dialog>
  );
}
