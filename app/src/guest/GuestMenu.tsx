import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  Globe,
  Info,
  LoaderCircle,
  MessageCircle,
  MessageCircleQuestion,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  dishImage,
  helperName,
  plain,
  type GuestDish,
  type GuestMenuData,
} from "./menu-data";
import { useCart, type Cart } from "./cart";
import { CategoryHeading, Hero, Ornament, useGuestLook } from "./Look";
import { firstVisitThisSession, useTracker } from "./track";
import { readTheme, type Theme } from "../lib/theme";
import {
  AddButton,
  DetailOrderControl,
  OrderBar,
  OrderSheet,
  StaffScreen,
  orderLines,
} from "./Order";
import { rtlLanguages, stringsFor, type GuestStrings } from "./strings";
import { AllergenIcons, AllergenLegend } from "./allergens";
import type { Allergen } from "../lib/extraction";

// The chat (and its code) loads only when a guest opens it.
const Chat = lazy(() => import("./Chat"));

type Filter = "vegetarian" | "vegan" | "noPork" | "noBeef" | "glutenFree";
const LANG_KEY = "mb.guestLang";
/** Menus with at least this many dishes get a search field. */
const SEARCH_FROM = 12;

/** Lowercase without accents, so "creme brulee" finds "Crème brûlée". */
const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function found(dish: GuestDish, words: string[]): boolean {
  const text = fold(
    [dish.name, dish.translated_name, dish.description]
      .filter(Boolean)
      .join(" "),
  );
  return words.every((w) => text.includes(w));
}

/**
 * Guest's language wishes, best first: a language in the link (?lang=fr, used by the marketing
 * site's demo), their earlier pick, then the phone's languages.
 */
function wishedLanguages(): string[] {
  const wishes: string[] = [];
  const fromLink = new URLSearchParams(location.search).get("lang");
  if (fromLink && /^[a-z]{2}$/.test(fromLink)) wishes.push(fromLink);
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
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [openDish, setOpenDish] = useState<GuestDish | null>(null);
  const table = useMemo(() => tableLabel(slug), [slug]);
  const cart = useCart(slug);
  const [orderOpen, setOrderOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // The Look screen's preview frame shows the page too: that isn't a guest.
  const inPreview = useMemo(
    () => new URLSearchParams(window.location.search).has("preview"),
    [],
  );
  const track = useTracker(slug, {
    enabled: !!menu?.restaurant.is_published && !inPreview,
    language: menu?.restaurant.language ?? language,
    table,
  });
  // Every way a guest adds a dish (list, dish sheet, order sheet, chat) goes through this cart.
  const trackedCart = useMemo(
    () => ({
      ...cart,
      add: (id: string) => {
        cart.add(id);
        track("add_to_cart", id);
      },
    }),
    [cart, track],
  );
  const openDishByGuest = (dish: GuestDish) => {
    setOpenDish(dish);
    track("view_item", dish.id);
  };
  const published = !!menu?.restaurant.is_published;
  useEffect(() => {
    if (published && !inPreview && firstVisitThisSession(slug)) track("scan");
  }, [published, inPreview, slug, track]);
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

  // Every dish on today's menu (filters aside), to show the order with live names and prices.
  const dishes = useMemo(
    () =>
      new Map(
        (menu?.categories ?? []).flatMap((c) => c.items.map((d) => [d.id, d])),
      ),
    [menu],
  );
  const { keepOnly } = cart;
  useEffect(() => {
    if (menu) keepOnly(new Set(dishes.keys()));
  }, [menu, dishes, keepOnly]);

  const shownLanguage = menu?.restaurant.language ?? language;
  const s = stringsFor(shownLanguage);
  useEffect(() => {
    document.documentElement.lang = shownLanguage;
    document.documentElement.dir = rtlLanguages.has(shownLanguage)
      ? "rtl"
      : "ltr";
    if (menu) document.title = menu.restaurant.name;
  }, [shownLanguage, menu]);

  const { theme, logo } = useGuestLook(
    menu?.restaurant.theme,
    menu?.restaurant.logo_path ?? null,
  );

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
  const searchable = dishes.size >= SEARCH_FROM;
  const words = fold(query).split(/\s+/).filter(Boolean);
  const results = words.length
    ? categories.flatMap((c) => c.items.filter((d) => found(d, words)))
    : null;
  // Pinned and most-ordered dishes; left out while searching or filtering, and when sold out.
  const popular =
    results || filters.size
      ? []
      : (restaurant.popular ?? [])
          .map((id) => dishes.get(id))
          .filter((d): d is GuestDish => !!d && d.in_stock);
  const usedAllergens = new Set<Allergen>(
    [...dishes.values()].flatMap((d) => d.allergens ?? []),
  );

  const changeLanguage = (lang: string) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // Not remembered; it still applies now.
    }
    setLanguage(lang);
    track("language_switch", undefined, lang);
  };

  const lines = orderLines(cart, dishes);

  const toggleFilter = (f: Filter) =>
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const languagePicker = restaurant.languages.length > 1 && (
    // Compact (globe + code) so the category chips keep the room; the phone's own picker
    // still lists every language by its full name.
    <label className="border-line bg-surface text-ink relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full border ps-2.5 pe-2 font-sans text-sm font-semibold">
      <Globe className="size-4" aria-hidden="true" />
      <span aria-hidden="true">{shownLanguage.toUpperCase()}</span>
      <ChevronDown className="text-ink-muted size-3.5" aria-hidden="true" />
      <select
        value={shownLanguage}
        onChange={(e) => changeLanguage(e.target.value)}
        aria-label={s.language}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {restaurant.languages.map((code) => (
          <option key={code} value={code}>
            {nativeName(code)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="min-h-dvh">
      {!restaurant.is_published && (
        <p className="bg-mustard-100 text-mustard-900 px-4 py-2 text-center text-sm font-semibold">
          {s.preview}
        </p>
      )}

      <Hero
        theme={theme}
        logo={logo}
        name={restaurant.name}
        tableText={table && s.table.replace("{table}", table)}
        // Only for the published tagline: a draft from the Look screen's preview has none yet.
        taglineTranslated={
          theme.tagline === readTheme(restaurant.theme).tagline
            ? (restaurant.tagline_translated ?? null)
            : null
        }
      />

      <header className="bg-canvas/95 border-line sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 py-2.5 ps-4 pe-4">
          <nav aria-label={s.categories} className="min-w-0 flex-1">
            {/* Chips fade out before the language button instead of being cut off. */}
            <ul className="-ms-4 flex [scrollbar-width:none] gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] ps-4 pe-6 rtl:[mask-image:linear-gradient(to_left,black_calc(100%-1.5rem),transparent)]">
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
                    className="bg-surface-muted text-ink inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap"
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
          {searchable && (
            <button
              type="button"
              onClick={() => {
                searchRef.current?.focus({ preventScroll: true });
                searchRef.current?.scrollIntoView({ block: "center" });
              }}
              aria-label={s.search}
              className="border-line bg-surface text-ink grid size-9 shrink-0 place-items-center rounded-full border"
            >
              <Search className="size-4" aria-hidden="true" />
            </button>
          )}
          {languagePicker}
        </div>
      </header>

      <main
        className={`mx-auto max-w-2xl px-4 ${lines.length ? "pb-44" : "pb-28"}`}
      >
        {searchable && (
          <div role="search" className="relative pt-4">
            <Search
              className="text-ink-muted pointer-events-none absolute start-3.5 top-[calc(1rem+0.8rem)] size-5"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.searchPlaceholder}
              aria-label={s.search}
              enterKeyHint="search"
              className="border-line bg-surface text-ink placeholder:text-ink-muted h-12 w-full rounded-full border ps-11 pe-12 text-base [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label={s.clearSearch}
                className="text-ink-muted absolute end-1 top-[calc(1rem+0.25rem)] grid size-10 place-items-center rounded-full"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

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

        {popular.length > 0 && (
          <section aria-labelledby="popular-title" className="pt-6">
            <h2
              id="popular-title"
              className="font-display text-ink text-2xl font-semibold"
            >
              {s.popular}
            </h2>
            <ul className="-mx-4 mt-3 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-2">
              {popular.map((dish) => (
                <li key={dish.id} className="w-44 shrink-0 snap-start">
                  <PopularCard
                    dish={dish}
                    money={money}
                    s={s}
                    qty={cart.qtyOf(dish.id)}
                    onAdd={() => trackedCart.add(dish.id)}
                    onOpen={() => openDishByGuest(dish)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {results && (
          <section aria-live="polite" className="pt-4">
            {results.length === 0 ? (
              <p className="text-ink-muted mt-6 text-center" dir="auto">
                {s.noResults.replace("{q}", query.trim())}
              </p>
            ) : (
              <ul
                className={
                  theme.layout === "list"
                    ? "divide-line divide-y"
                    : "mt-2 space-y-3"
                }
              >
                {results.map((dish) => (
                  <li key={dish.id}>
                    <DishCard
                      dish={dish}
                      money={money}
                      s={s}
                      layout={theme.layout}
                      qty={cart.qtyOf(dish.id)}
                      onAdd={() => trackedCart.add(dish.id)}
                      onOpen={() => openDishByGuest(dish)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!results && categories.length === 0 && (
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

        {!results &&
          categories.map((c, index) => {
            const translated =
              c.translated_name && plain(c.translated_name) !== plain(c.name)
                ? c.translated_name
                : null;
            return (
              <section
                key={c.id}
                id={`cat-${c.id}`}
                aria-labelledby={`h-${c.id}`}
                className="scroll-mt-20 pt-7"
              >
                {index > 0 && (
                  <Ornament
                    theme={theme}
                    name={restaurant.name}
                    className="mb-6"
                  />
                )}
                <CategoryHeading
                  theme={theme}
                  id={`h-${c.id}`}
                  name={c.name}
                  translated={translated}
                />
                <ul
                  className={
                    c.compact
                      ? "divide-line mt-2 divide-y"
                      : theme.layout === "list"
                        ? "divide-line mt-2 divide-y"
                        : "mt-4 space-y-3"
                  }
                >
                  {c.items.map((dish) => (
                    <li key={dish.id}>
                      {c.compact ? (
                        <CompactRow
                          dish={dish}
                          money={money}
                          s={s}
                          qty={cart.qtyOf(dish.id)}
                          onAdd={() => trackedCart.add(dish.id)}
                          onOpen={() => openDishByGuest(dish)}
                        />
                      ) : (
                        <DishCard
                          dish={dish}
                          money={money}
                          s={s}
                          layout={theme.layout}
                          qty={cart.qtyOf(dish.id)}
                          onAdd={() => trackedCart.add(dish.id)}
                          onOpen={() => openDishByGuest(dish)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

        {restaurant.show_allergens && (
          <AllergenLegend used={usedAllergens} s={s} />
        )}

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
          cart={trackedCart}
          onClose={() => setOpenDish(null)}
        />
      )}

      {/* Questions about the menu: published menus only (the chat reads the published menu). */}
      {restaurant.is_published && !orderOpen && !staffOpen && !chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className={`bg-surface text-ink border-line fixed end-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-full border ps-4 pe-5 font-semibold shadow-lg ${
            lines.length
              ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
              : "bottom-[max(1rem,env(safe-area-inset-bottom))]"
          }`}
        >
          <MessageCircle
            className="text-brand-strong size-5"
            aria-hidden="true"
          />
          {restaurant.assistant_name
            ? s.chat.openNamed.replace("{name}", restaurant.assistant_name)
            : s.chat.open}
        </button>
      )}
      {chatOpen && (
        <Suspense fallback={null}>
          <Chat
            slug={slug}
            language={shownLanguage}
            s={s}
            dishes={dishes}
            cart={trackedCart}
            money={money}
            onOpenDish={openDishByGuest}
            onClose={() => setChatOpen(false)}
            assistantName={restaurant.assistant_name}
          />
        </Suspense>
      )}

      {!orderOpen && !staffOpen && (
        <OrderBar
          lines={lines}
          money={money}
          s={s}
          onOpen={() => setOrderOpen(true)}
        />
      )}
      {orderOpen && (
        <OrderSheet
          lines={lines}
          cart={trackedCart}
          money={money}
          s={s}
          table={table}
          onShowStaff={() => {
            setStaffOpen(true);
            track("show_to_staff");
          }}
          onClose={() => setOrderOpen(false)}
        />
      )}
      {staffOpen && (
        <StaffScreen
          lines={lines}
          money={money}
          s={s}
          staff={stringsFor(restaurant.source_language)}
          restaurantName={restaurant.name}
          table={table}
          onClose={() => setStaffOpen(false)}
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

function AllergenLine({
  dish,
  s,
  icons,
}: {
  dish: GuestDish;
  s: GuestStrings;
  /** In the list: confirmed allergens as icons (names in the legend and the dish sheet). */
  icons?: boolean;
}) {
  if (dish.allergens_confirmed === null) return null; // restaurant doesn't show allergens
  if (icons && dish.allergens_confirmed && dish.allergens?.length)
    return <AllergenIcons allergens={dish.allergens} s={s} />;
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
  layout,
  qty,
  onAdd,
  onOpen,
}: {
  dish: GuestDish;
  money: Intl.NumberFormat;
  s: GuestStrings;
  layout: Theme["layout"];
  qty: number;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const big = layout === "photos" ? dishImage(dish.image_path) : null;
  const thumb = big ? null : dishImage(dish.thumb_path ?? dish.image_path);
  const helper = helperName(dish);
  const add = dish.in_stock && (
    <AddButton dish={dish} qty={qty} s={s} onAdd={onAdd} />
  );
  // Like delivery apps: name, price on its own line, then the description; photo and + on the right.
  const text = (
    <>
      <span
        className="block text-lg leading-snug font-semibold [overflow-wrap:anywhere]"
        dir="auto"
      >
        {dish.name}
      </span>
      {helper && (
        <span className="text-ink-muted block text-sm font-medium" dir="auto">
          {helper}
        </span>
      )}
      {(dish.price !== null || !dish.in_stock) && (
        <span className="mt-1 flex flex-wrap items-center gap-2">
          {dish.price !== null && (
            <span className="text-ink text-base font-semibold tabular-nums">
              {money.format(dish.price)}
            </span>
          )}
          {!dish.in_stock && (
            <span className="bg-ink-muted text-canvas inline-block rounded-full px-2.5 py-0.5 text-xs font-bold">
              {s.soldOut}
            </span>
          )}
        </span>
      )}
      <Description dish={dish} s={s} clamp />
      <Tags dish={dish} s={s} />
      <AllergenLine dish={dish} s={s} icons />
    </>
  );
  // The whole card opens the dish (stretched button); the + sits above it.
  const open = "text-start after:absolute after:inset-0 after:content-['']";
  const card = layout === "list" ? "" : "bg-surface rounded-card shadow-sm";
  const faded = dish.in_stock ? "" : "opacity-60";

  if (big)
    return (
      <div className={`relative overflow-hidden ${card} ${faded}`}>
        <img
          src={big}
          alt=""
          loading="lazy"
          className="aspect-[16/10] w-full object-cover"
        />
        {add && <div className="absolute end-3 top-3">{add}</div>}
        <button
          type="button"
          onClick={onOpen}
          className={`block w-full p-4 ${open}`}
        >
          {text}
        </button>
      </div>
    );

  return (
    <div
      className={`relative flex gap-3 ${layout === "list" ? "py-4" : "p-4"} ${card} ${faded}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className={`min-w-0 flex-1 ${open}`}
      >
        {text}
      </button>
      {thumb ? (
        <div className="relative shrink-0 self-start">
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="rounded-control border-line size-28 border object-cover"
          />
          {add && <div className="absolute -end-2 -top-2">{add}</div>}
        </div>
      ) : (
        add && <div className="shrink-0 self-start">{add}</div>
      )}
    </div>
  );
}

/** One line per dish (name and price, small photo): for categories the owner made compact. */
function CompactRow({
  dish,
  money,
  s,
  qty,
  onAdd,
  onOpen,
}: {
  dish: GuestDish;
  money: Intl.NumberFormat;
  s: GuestStrings;
  qty: number;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const thumb = dishImage(dish.thumb_path ?? dish.image_path);
  const helper = helperName(dish);
  return (
    <div
      className={`relative flex min-h-14 items-center gap-3 py-2.5 ${dish.in_stock ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-start after:absolute after:inset-0 after:content-['']"
      >
        <span
          className="block leading-snug font-semibold [overflow-wrap:anywhere]"
          dir="auto"
        >
          {dish.name}
        </span>
        {helper && (
          <span className="text-ink-muted block text-sm" dir="auto">
            {helper}
          </span>
        )}
      </button>
      {!dish.in_stock ? (
        <span className="bg-ink-muted text-canvas shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold">
          {s.soldOut}
        </span>
      ) : (
        dish.price !== null && (
          <span className="shrink-0 font-semibold tabular-nums">
            {money.format(dish.price)}
          </span>
        )
      )}
      {thumb && (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="rounded-control border-line size-12 shrink-0 border object-cover"
        />
      )}
      {dish.in_stock && (
        <div className="relative shrink-0">
          <AddButton dish={dish} qty={qty} s={s} onAdd={onAdd} />
        </div>
      )}
    </div>
  );
}

/** A card in the "Popular" row: photo on top (if any), name as on the menu, translation, price, +. */
function PopularCard({
  dish,
  money,
  s,
  qty,
  onAdd,
  onOpen,
}: {
  dish: GuestDish;
  money: Intl.NumberFormat;
  s: GuestStrings;
  qty: number;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const thumb = dishImage(dish.image_path ?? dish.thumb_path);
  const helper = helperName(dish);
  return (
    <div className="bg-surface rounded-card relative flex h-full flex-col overflow-hidden shadow-sm">
      {thumb && (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="aspect-[16/10] w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col p-3">
        <button
          type="button"
          onClick={onOpen}
          className="text-start after:absolute after:inset-0 after:content-['']"
        >
          <span
            className="line-clamp-2 leading-snug font-semibold [overflow-wrap:anywhere]"
            dir="auto"
          >
            {dish.name}
          </span>
          {helper && (
            <span className="text-ink-muted line-clamp-1 text-sm" dir="auto">
              {helper}
            </span>
          )}
        </button>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-semibold tabular-nums">
            {dish.price !== null && money.format(dish.price)}
          </span>
          <div className="relative">
            <AddButton dish={dish} qty={qty} s={s} onAdd={onAdd} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DishDetail({
  dish,
  money,
  s,
  cart,
  onClose,
}: {
  dish: GuestDish;
  money: Intl.NumberFormat;
  s: GuestStrings;
  cart: Cart;
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
          <p className="bg-ink-muted text-canvas mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold">
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
        <DetailOrderControl dish={dish} cart={cart} money={money} s={s} />
      </div>
    </dialog>
  );
}
