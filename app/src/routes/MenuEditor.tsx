import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CircleCheck, CircleAlert, ShieldAlert, Upload } from "lucide-react";
import { FullPageSpinner } from "../components/FullPageSpinner";
import { fill, useI18n } from "../i18n";
import { AllergenSwitch } from "../menu/AllergenSwitch";
import { BulkPrices } from "../menu/BulkPrices";
import { CategorySection, useDragSensors } from "../menu/CategorySection";
import { DishSheet } from "../menu/DishSheet";
import { InlineAdd } from "../menu/InlineAdd";
import { restrictToVerticalAxis } from "../menu/dndModifiers";
import { Toast } from "../menu/Toast";
import {
  useMenuEditor,
  type Item,
  type ToastKind,
} from "../menu/useMenuEditor";
import { useRestaurant } from "../restaurant/RestaurantProvider";

/** Edit menu mode (CLAUDE.md 4.5): live editor + bulk prices tab. Everything autosaves. */
export function MenuEditor() {
  const { t } = useI18n();
  const { restaurant } = useRestaurant();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "prices" ? "prices" : "menu";
  const [editingId, setEditingId] = useState<string | null>(null);
  // True while walking through dishes with "Start confirming" / "Confirm & next".
  const [confirming, setConfirming] = useState(false);
  const openDish = (id: string | null, viaConfirm = false) => {
    setConfirming(viaConfirm);
    setEditingId(id);
  };
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const sensors = useDragSensors();

  const describe = useCallback(
    (toast: ToastKind) => {
      switch (toast.kind) {
        case "saved":
          return t.editor.toast.saved;
        case "deletedDish":
          return fill(t.editor.toast.deletedDish, { name: toast.name });
        case "deletedCategory":
          return fill(t.editor.toast.deletedCategory, { name: toast.name });
        case "pricesChanged":
          return fill(t.editor.toast.pricesChanged, { count: toast.count });
        case "error":
          return t.editor.toast.error;
      }
    },
    [t],
  );
  const editor = useMenuEditor(restaurant.id, describe);

  if (editor.loadFailed && !editor.categories)
    return <FullPageSpinner error onRetry={() => void editor.reload()} />;
  if (!editor.categories) return <FullPageSpinner />;

  const categories = editor.categories;
  // Dishes in menu order, for the to-do links.
  const ordered: Item[] = categories.flatMap((c) => editor.itemsIn(c.id));
  const showAllergens = restaurant.show_allergens;
  // Kept per dish even while allergens are off, so switching on only asks for these.
  const unconfirmed = ordered.filter(
    (i) => i.allergen_status !== "confirmed" && !i.is_hidden,
  );
  const needAllergens = showAllergens ? unconfirmed : [];
  const needPrice = ordered.filter((i) => i.price === null && !i.is_hidden);
  const editing = editor.items.find((i) => i.id === editingId) ?? null;
  // "Confirm & next": the next unconfirmed dish after this one in menu order (then from the top).
  const nextToConfirm = (() => {
    if (!editing) return null;
    const others = unconfirmed.filter((i) => i.id !== editing.id);
    const index = ordered.findIndex((i) => i.id === editing.id);
    return others.find((i) => ordered.indexOf(i) > index) ?? others[0] ?? null;
  })();

  const goTo = (item: Item | undefined) => {
    if (!item) return;
    setParams({});
    requestAnimationFrame(() => {
      document
        .getElementById(`dish-${item.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(item.id);
      setTimeout(() => setHighlightId(null), 2500);
    });
  };

  const onCategoryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = categories.map((c) => c.id);
    void editor.reorderCategories(
      arrayMove(
        ids,
        ids.indexOf(String(active.id)),
        ids.indexOf(String(over.id)),
      ),
    );
  };

  return (
    <div className="pb-24">
      <h1 className="text-3xl font-semibold sm:text-4xl">{t.editor.title}</h1>
      <p className="text-ink-muted mt-1">{t.editor.autosave}</p>

      {ordered.length > 0 && (
        <AllergenSwitch
          pendingCount={unconfirmed.length}
          onStartConfirming={() => openDish(unconfirmed[0]?.id ?? null, true)}
        />
      )}

      {ordered.length > 0 && (
        <ul
          className="mt-5 flex flex-wrap gap-2"
          aria-label={t.editor.todo.label}
        >
          {needAllergens.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => goTo(needAllergens[0])}
                className="bg-mustard-100 text-mustard-900 inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold"
              >
                <ShieldAlert className="size-5" aria-hidden="true" />
                {needAllergens.length === 1
                  ? t.editor.todo.allergensOne
                  : fill(t.editor.todo.allergens, {
                      count: needAllergens.length,
                    })}
              </button>
            </li>
          )}
          {needPrice.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => goTo(needPrice[0])}
                className="bg-paprika-50 text-danger inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold"
              >
                <CircleAlert className="size-5" aria-hidden="true" />
                {needPrice.length === 1
                  ? t.editor.todo.pricesOne
                  : fill(t.editor.todo.prices, { count: needPrice.length })}
              </button>
            </li>
          )}
          {needAllergens.length === 0 && needPrice.length === 0 && (
            <li className="bg-herb-50 text-herb-800 inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold">
              <CircleCheck className="size-5" aria-hidden="true" />
              {t.editor.todo.allDone}
            </li>
          )}
        </ul>
      )}

      {ordered.length > 0 && (
        <div
          role="tablist"
          className="bg-oat-100 rounded-control mt-6 grid grid-cols-2 gap-1 p-1"
        >
          {(["menu", "prices"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() =>
                setParams(key === "prices" ? { tab: "prices" } : {})
              }
              className={`rounded-control min-h-11 font-semibold ${
                tab === key
                  ? "bg-surface shadow-card text-ink"
                  : "text-ink-muted"
              }`}
            >
              {t.editor.tabs[key]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        {tab === "prices" && ordered.length > 0 ? (
          <BulkPrices editor={editor} currency={restaurant.currency} />
        ) : (
          <>
            {categories.length === 0 && (
              <div className="rounded-card bg-surface shadow-card p-6 text-center">
                <h2 className="text-2xl font-semibold">
                  {t.editor.empty.title}
                </h2>
                <p className="text-ink-muted mx-auto mt-2 max-w-md">
                  {t.editor.empty.text}
                </p>
                <Link to="/upload" className="btn-primary mt-5">
                  <Upload className="size-5" aria-hidden="true" />
                  {t.editor.empty.upload}
                </Link>
              </div>
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={onCategoryDragEnd}
            >
              <SortableContext
                items={categories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-5">
                  {categories.map((category) => (
                    <CategorySection
                      key={category.id}
                      category={category}
                      editor={editor}
                      currency={restaurant.currency}
                      onEditDish={(id) => openDish(id)}
                      highlightId={highlightId}
                      showAllergens={showAllergens}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-5 text-center">
              <InlineAdd
                large
                label={t.editor.addCategory}
                placeholder={t.editor.categoryName}
                onAdd={(name) => editor.addCategory(name)}
              />
            </div>
          </>
        )}
      </div>

      {editing && (
        <DishSheet
          key={editing.id}
          item={editing}
          categories={categories}
          restaurantId={restaurant.id}
          editor={editor}
          showAllergens={showAllergens}
          startAtAllergens={confirming}
          onNextToConfirm={
            nextToConfirm ? () => openDish(nextToConfirm.id, true) : null
          }
          onClose={() => setEditingId(null)}
        />
      )}
      <Toast toast={editor.toast} onDismiss={editor.dismissToast} />
    </div>
  );
}
