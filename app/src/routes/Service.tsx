import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CircleCheck, RotateCcw, Search, Upload, X } from "lucide-react";
import { FullPageSpinner } from "../components/FullPageSpinner";
import { fill, useI18n } from "../i18n";
import type { Tables } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { Toast } from "../menu/Toast";
import type { Toast as ToastData } from "../menu/useMenuEditor";
import { useRestaurant } from "../restaurant/RestaurantProvider";

type Category = Pick<Tables<"menu_categories">, "id" | "name" | "sort_order">;
type Dish = Pick<
  Tables<"menu_items">,
  "id" | "name" | "category_id" | "sort_order" | "in_stock" | "is_hidden"
>;

/** "Crème brûlée" is found with "creme". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Service mode (CLAUDE.md 4.5): during opening hours, one big switch per dish for in stock /
 * sold out. Only stock can change here. Other phones' changes arrive live (Realtime).
 */
export function Service() {
  const { t } = useI18n();
  const { restaurant, role } = useRestaurant();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastCounter = useRef(0);

  const load = useCallback(async () => {
    const [cats, items] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name, sort_order")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order"),
      supabase
        .from("menu_items")
        .select("id, name, category_id, sort_order, in_stock, is_hidden")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order"),
    ]);
    if (cats.error || items.error) return setLoadFailed(true);
    setLoadFailed(false);
    setCategories(cats.data);
    setDishes(items.data);
  }, [restaurant.id]);

  useEffect(() => {
    void load();
    // Live: switches made on another phone (or in Edit menu) show up here.
    const channel = supabase
      .channel(`service-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "menu_items",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const row = payload.new as Dish;
          setDishes((list) =>
            list.map((d) =>
              d.id === row.id
                ? {
                    ...d,
                    in_stock: row.in_stock,
                    is_hidden: row.is_hidden,
                    name: row.name,
                  }
                : d,
            ),
          );
        },
      )
      .subscribe();
    // A phone that slept may have missed updates: reload when it comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [load, restaurant.id]);

  const showToast = (message: string, options: Partial<ToastData> = {}) =>
    setToast({ id: ++toastCounter.current, message, ...options });
  const dismissToast = useCallback(() => setToast(null), []);

  const setLocalStock = (ids: string[], inStock: boolean) =>
    setDishes((list) =>
      list.map((d) => (ids.includes(d.id) ? { ...d, in_stock: inStock } : d)),
    );

  /** Switch dishes; on failure put them back and say so. */
  const setStock = async (ids: string[], inStock: boolean) => {
    setLocalStock(ids, inStock);
    const { error } = await supabase.rpc("set_stock", {
      p_item_ids: ids,
      p_in_stock: inStock,
    });
    if (error) {
      setLocalStock(ids, !inStock);
      showToast(t.editor.toast.error, { error: true });
      return false;
    }
    return true;
  };

  const resetAll = async () => {
    setConfirmReset(false);
    const out = dishes.filter((d) => !d.in_stock).map((d) => d.id);
    setLocalStock(out, true);
    const { data, error } = await supabase.rpc("reset_stock", {
      p_restaurant_id: restaurant.id,
    });
    if (error) {
      setLocalStock(out, false);
      return showToast(t.editor.toast.error, { error: true });
    }
    const changed = (data ?? []) as string[];
    showToast(
      changed.length === 1
        ? t.service.resetDoneOne
        : fill(t.service.resetDone, { count: changed.length }),
      {
        undo: async () => {
          if (await setStock(changed, false)) setToast(null);
        },
      },
    );
  };

  if (loadFailed && !categories)
    return <FullPageSpinner error onRetry={() => void load()} />;
  if (!categories) return <FullPageSpinner />;

  const visible = dishes.filter((d) => !d.is_hidden);
  const byCategory = (id: string) =>
    visible
      .filter((d) => d.category_id === id)
      .sort((a, b) => a.sort_order - b.sort_order);
  const ordered = categories.flatMap((c) => byCategory(c.id));
  const soldOut = ordered.filter((d) => !d.in_stock);
  const q = normalize(query.trim());
  const matches = (d: Dish) => !q || normalize(d.name).includes(q);
  const anyMatch = ordered.some(matches);
  const s = t.service;

  return (
    <div className="pb-24">
      <h1 className="text-3xl font-semibold sm:text-4xl">{s.title}</h1>
      <p className="text-ink-muted mt-1">{s.intro}</p>

      {ordered.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card mt-6 p-6 text-center">
          <p className="text-lg">{role === "staff" ? s.emptyStaff : s.empty}</p>
          {role === "owner" && (
            <Link to="/upload" className="btn-primary mt-4">
              <Upload className="size-5" aria-hidden="true" />
              {s.emptyLink}
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Sold out now */}
          <section
            aria-labelledby="sold-out"
            className={`rounded-card mt-5 p-4 ${soldOut.length ? "bg-paprika-50" : "bg-herb-50"}`}
          >
            <h2 id="sold-out" className="font-sans text-base font-semibold">
              {s.outNow}
            </h2>
            {soldOut.length === 0 ? (
              <p className="text-herb-800 mt-1 flex items-center gap-2">
                <CircleCheck className="size-5" aria-hidden="true" />
                {s.outNone}
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {soldOut.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => void setStock([d.id], true)}
                      className="bg-surface border-line inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pr-2 pl-4 font-semibold"
                      aria-label={fill(s.backInStock, { name: d.name })}
                    >
                      {d.name}
                      <span className="bg-oat-100 grid size-7 place-items-center rounded-full">
                        <RotateCcw className="size-4" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Search */}
          {/* Sticks right under the app header (64 px bar + 44 px tabs + 1 px border). */}
          <div className="bg-canvas/95 sticky top-[calc(env(safe-area-inset-top)+109px)] z-[5] -mx-4 mt-4 px-4 py-2 backdrop-blur">
            <label className="relative block">
              <span className="sr-only">{s.search}</span>
              <Search
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={s.search}
                enterKeyHint="search"
                className="input pr-12 pl-11"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-ink-muted absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center"
                  aria-label={s.searchClear}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              )}
            </label>
          </div>

          {!anyMatch && (
            <p className="text-ink-muted mt-6 text-center" role="status">
              {fill(s.noResults, { query: query.trim() })}
            </p>
          )}

          <div className="mt-2 space-y-6">
            {categories.map((category) => {
              const list = byCategory(category.id).filter(matches);
              if (!list.length) return null;
              return (
                <section
                  key={category.id}
                  aria-labelledby={`cat-${category.id}`}
                >
                  <h2
                    id={`cat-${category.id}`}
                    className="mb-2 text-xl font-semibold"
                  >
                    {category.name}
                  </h2>
                  <ul className="space-y-2">
                    {list.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={d.in_stock}
                          onClick={() => void setStock([d.id], !d.in_stock)}
                          className={`rounded-card flex min-h-16 w-full items-center gap-3 border-2 px-4 py-3 text-left transition-colors ${
                            d.in_stock
                              ? "bg-surface border-herb-600"
                              : "bg-oat-100 border-oat-300"
                          }`}
                        >
                          <span
                            className={`min-w-0 flex-1 text-lg leading-snug font-semibold [overflow-wrap:anywhere] ${
                              d.in_stock
                                ? "text-ink"
                                : "text-ink-muted line-through"
                            }`}
                          >
                            {d.name}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${
                              d.in_stock
                                ? "bg-herb-600 text-white"
                                : "bg-oat-600 text-white"
                            }`}
                          >
                            {d.in_stock ? s.inStock : s.outOfStock}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <p className="text-ink-muted mt-6 text-center text-sm">
            {s.hiddenNote}
          </p>

          {/* Reset for the next service */}
          <div className="mt-6">
            {confirmReset ? (
              <div
                role="alertdialog"
                aria-labelledby="reset-q"
                className="rounded-card bg-surface shadow-card p-4"
              >
                <p id="reset-q" className="font-semibold">
                  {soldOut.length === 1
                    ? s.resetConfirmOne
                    : fill(s.resetConfirm, { count: soldOut.length })}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void resetAll()}
                    className="btn-primary"
                  >
                    {s.resetYes}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="btn-secondary"
                  >
                    {t.editor.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={soldOut.length === 0}
                onClick={() => setConfirmReset(true)}
                className="btn-secondary w-full"
              >
                <RotateCcw className="size-5" aria-hidden="true" />
                {s.reset}
              </button>
            )}
          </div>
        </>
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
