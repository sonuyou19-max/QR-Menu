import { useCallback, useEffect, useRef, useState } from "react";
import type { Tables, TablesUpdate } from "../lib/database.types";
import { supabase } from "../lib/supabase";

export type Category = Tables<"menu_categories">;
export type Item = Tables<"menu_items">;
export type ItemPatch = Omit<
  TablesUpdate<"menu_items">,
  "id" | "restaurant_id" | "updated_at"
>;

export interface Toast {
  id: number;
  message: string;
  undo?: (() => Promise<void>) | undefined;
  error?: boolean;
}

/** What the toast says; the screen turns it into text in the dashboard language. */
export type ToastKind =
  | { kind: "saved" }
  | { kind: "deletedDish"; name: string }
  | { kind: "deletedCategory"; name: string }
  | { kind: "pricesChanged"; count: number }
  | { kind: "error" };

const byOrder = <T extends { sort_order: number }>(a: T, b: T) =>
  a.sort_order - b.sort_order;

/**
 * The menu being edited, with autosave: every change shows at once, is saved in the background,
 * and can be undone from the toast for a few seconds. A failed save puts the old values back.
 */
export function useMenuEditor(
  restaurantId: string,
  describe: (toast: ToastKind) => string,
) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastCounter = useRef(0);
  // Latest state for callbacks that run after awaits.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const describeRef = useRef(describe);
  describeRef.current = describe;

  const load = useCallback(async () => {
    const [cats, dishes] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
      supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
    ]);
    if (cats.error || dishes.error) return setLoadFailed(true);
    setLoadFailed(false);
    setCategories(cats.data);
    setItems(dishes.data);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const show = useCallback(
    (kind: ToastKind, undo?: () => Promise<void>) =>
      setToast({
        id: ++toastCounter.current,
        message: describeRef.current(kind),
        undo,
        error: kind.kind === "error",
      }),
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  /** Apply locally, save, and on failure put the previous state back. */
  const run = useCallback(
    async (
      apply: () => void,
      revert: () => void,
      save: () => PromiseLike<{ error: unknown }>,
    ): Promise<boolean> => {
      apply();
      const { error } = await save();
      if (error) {
        console.error(error);
        revert();
        show({ kind: "error" });
        return false;
      }
      return true;
    },
    [show],
  );

  const patchItemsLocal = (id: string, patch: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // Save, and take over the content_hash the database computes from the texts, so the
  // "not translated yet" count follows edits without a reload.
  const saveItem = (id: string, values: ItemPatch) =>
    supabase
      .from("menu_items")
      .update(values)
      .eq("id", id)
      .select("content_hash")
      .single()
      .then((res) => {
        if (res.data)
          patchItemsLocal(id, { content_hash: res.data.content_hash });
        return res;
      });

  /** Change fields of one dish. `quiet` skips the toast (e.g. the stock switch). */
  const updateItem = useCallback(
    async (id: string, patch: ItemPatch, options: { quiet?: boolean } = {}) => {
      const current = itemsRef.current.find((i) => i.id === id);
      if (!current) return;
      const before = Object.fromEntries(
        Object.keys(patch).map((key) => [key, current[key as keyof Item]]),
      ) as ItemPatch;
      const saved = await run(
        () => patchItemsLocal(id, patch as Partial<Item>),
        () => patchItemsLocal(id, before as Partial<Item>),
        () => saveItem(id, patch),
      );
      if (saved && !options.quiet)
        show({ kind: "saved" }, async () => {
          await run(
            () => patchItemsLocal(id, before as Partial<Item>),
            () => patchItemsLocal(id, patch as Partial<Item>),
            () => saveItem(id, before),
          );
          setToast(null);
        });
    },
    [run, show],
  );

  const updateCategory = useCallback(
    async (id: string, name: string) => {
      const current = categoriesRef.current?.find((c) => c.id === id);
      if (!current || current.name === name) return;
      const setLocal = (patch: Partial<Category>) =>
        setCategories(
          (list) =>
            list?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? null,
        );
      const setName = (value: string) => setLocal({ name: value });
      // Like saveItem: keep the database's content_hash for the translation count.
      const save = (value: string) =>
        supabase
          .from("menu_categories")
          .update({ name: value })
          .eq("id", id)
          .select("content_hash")
          .single()
          .then((res) => {
            if (res.data) setLocal({ content_hash: res.data.content_hash });
            return res;
          });
      const saved = await run(
        () => setName(name),
        () => setName(current.name),
        () => save(name),
      );
      if (saved)
        show({ kind: "saved" }, async () => {
          await run(
            () => setName(current.name),
            () => setName(name),
            () => save(current.name),
          );
          setToast(null);
        });
    },
    [run, show],
  );

  /** New dish at the end of a category. Returns its id. */
  const addItem = useCallback(
    async (categoryId: string, name: string): Promise<string | null> => {
      const siblings = itemsRef.current.filter(
        (i) => i.category_id === categoryId,
      );
      const { data, error } = await supabase
        .from("menu_items")
        .insert({
          restaurant_id: restaurantId,
          category_id: categoryId,
          name,
          // allergen_status defaults to "suggested": the owner still confirms (even "none").
          sort_order: siblings.length
            ? Math.max(...siblings.map((i) => i.sort_order)) + 1
            : 0,
        })
        .select()
        .single();
      if (error || !data) {
        show({ kind: "error" });
        return null;
      }
      setItems((list) => [...list, data]);
      return data.id;
    },
    [restaurantId, show],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const current = itemsRef.current.find((i) => i.id === id);
      if (!current) return;
      const saved = await run(
        () => setItems((list) => list.filter((i) => i.id !== id)),
        () => setItems((list) => [...list, current]),
        () => supabase.from("menu_items").delete().eq("id", id),
      );
      if (saved)
        show({ kind: "deletedDish", name: current.name }, async () => {
          await run(
            () => setItems((list) => [...list, current]),
            () => setItems((list) => list.filter((i) => i.id !== id)),
            () =>
              supabase.from("menu_items").insert(withoutTimestamps(current)),
          );
          setToast(null);
        });
    },
    [run, show],
  );

  const addCategory = useCallback(
    async (name: string) => {
      const list = categoriesRef.current ?? [];
      const { data, error } = await supabase
        .from("menu_categories")
        .insert({
          restaurant_id: restaurantId,
          name,
          sort_order: list.length
            ? Math.max(...list.map((c) => c.sort_order)) + 1
            : 0,
        })
        .select()
        .single();
      if (error || !data) return show({ kind: "error" });
      setCategories((cats) => [...(cats ?? []), data]);
    },
    [restaurantId, show],
  );

  /** Delete a category together with its dishes (the screen asks first when it has dishes). */
  const deleteCategory = useCallback(
    async (id: string) => {
      const category = categoriesRef.current?.find((c) => c.id === id);
      if (!category) return;
      const dishes = itemsRef.current.filter((i) => i.category_id === id);
      const removeLocal = () => {
        setCategories((list) => list?.filter((c) => c.id !== id) ?? null);
        setItems((list) => list.filter((i) => i.category_id !== id));
      };
      const restoreLocal = () => {
        setCategories((list) => [...(list ?? []), category]);
        setItems((list) => [...list, ...dishes]);
      };
      const saved = await run(removeLocal, restoreLocal, async () => {
        if (dishes.length) {
          const { error } = await supabase
            .from("menu_items")
            .delete()
            .eq("category_id", id);
          if (error) return { error };
        }
        return supabase.from("menu_categories").delete().eq("id", id);
      });
      if (saved)
        show({ kind: "deletedCategory", name: category.name }, async () => {
          await run(restoreLocal, removeLocal, async () => {
            const { error } = await supabase
              .from("menu_categories")
              .insert(category);
            if (error || !dishes.length) return { error };
            return supabase
              .from("menu_items")
              .insert(dishes.map(withoutTimestamps));
          });
          setToast(null);
        });
    },
    [run, show],
  );

  const reorderCategories = useCallback(
    async (ids: string[]) => {
      const before = (categoriesRef.current ?? []).map((c) => c.id);
      const setOrder = (order: string[]) =>
        setCategories(
          (list) =>
            list?.map((c) => ({ ...c, sort_order: order.indexOf(c.id) })) ??
            null,
        );
      const saved = await run(
        () => setOrder(ids),
        () => setOrder(before),
        () => supabase.rpc("reorder_categories", { p_ids: ids }),
      );
      if (saved)
        show({ kind: "saved" }, async () => {
          await run(
            () => setOrder(before),
            () => setOrder(ids),
            () => supabase.rpc("reorder_categories", { p_ids: before }),
          );
          setToast(null);
        });
    },
    [run, show],
  );

  /** New order of the dishes in one category (also used to move a dish into it). */
  const reorderItems = useCallback(
    async (categoryId: string, ids: string[]) => {
      const before = itemsRef.current.filter((i) => ids.includes(i.id));
      const setOrder = () =>
        setItems((list) =>
          list.map((i) =>
            ids.includes(i.id)
              ? { ...i, category_id: categoryId, sort_order: ids.indexOf(i.id) }
              : i,
          ),
        );
      const restore = () =>
        setItems((list) =>
          list.map((i) => before.find((b) => b.id === i.id) ?? i),
        );
      const saved = await run(setOrder, restore, () =>
        supabase.rpc("reorder_items", {
          p_category_id: categoryId,
          p_ids: ids,
        }),
      );
      if (saved)
        show({ kind: "saved" }, async () => {
          await run(restore, setOrder, async () => {
            for (const item of before) {
              const { error } = await supabase
                .from("menu_items")
                .update({
                  category_id: item.category_id,
                  sort_order: item.sort_order,
                })
                .eq("id", item.id);
              if (error) return { error };
            }
            return { error: null };
          });
          setToast(null);
        });
    },
    [run, show],
  );

  /** Bulk prices: apply several price changes at once, undoable as one. */
  const setPrices = useCallback(
    async (changes: { id: string; price: number | null }[]) => {
      const before = changes.map(({ id }) => ({
        id,
        price: itemsRef.current.find((i) => i.id === id)?.price ?? null,
      }));
      const apply = (list: { id: string; price: number | null }[]) =>
        setItems((current) =>
          current.map((i) => {
            const change = list.find((c) => c.id === i.id);
            return change ? { ...i, price: change.price } : i;
          }),
        );
      const save =
        (list: { id: string; price: number | null }[]) => async () => {
          const results = await Promise.all(
            list.map(({ id, price }) =>
              supabase.from("menu_items").update({ price }).eq("id", id),
            ),
          );
          return { error: results.find((r) => r.error)?.error ?? null };
        };
      const saved = await run(
        () => apply(changes),
        () => apply(before),
        save(changes),
      );
      if (saved)
        show({ kind: "pricesChanged", count: changes.length }, async () => {
          await run(
            () => apply(before),
            () => apply(changes),
            save(before),
          );
          setToast(null);
        });
      return saved;
    },
    [run, show],
  );

  const sortedCategories = categories ? [...categories].sort(byOrder) : null;
  const itemsIn = useCallback(
    (categoryId: string) =>
      items.filter((i) => i.category_id === categoryId).sort(byOrder),
    [items],
  );

  return {
    categories: sortedCategories,
    items,
    itemsIn,
    loadFailed,
    reload: load,
    toast,
    dismissToast,
    showError: () => show({ kind: "error" }),
    updateItem,
    updateCategory,
    addItem,
    deleteItem,
    addCategory,
    deleteCategory,
    reorderCategories,
    reorderItems,
    setPrices,
  };
}

export type MenuEditor = ReturnType<typeof useMenuEditor>;

function withoutTimestamps(item: Item) {
  const { updated_at: _updated, ...rest } = item;
  return rest;
}
