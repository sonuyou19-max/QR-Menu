import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "./dndModifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { fill, useI18n } from "../i18n";
import { DishRow } from "./DishRow";
import { InlineAdd } from "./InlineAdd";
import type { Category, MenuEditor } from "./useMenuEditor";

export function useDragSensors() {
  return useSensors(
    // A small move before dragging starts, so taps on the handle still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}

/** A category as on the menu: rename, reorder, delete, and its dishes in printed order. */
export function CategorySection({
  category,
  editor,
  currency,
  onEditDish,
  highlightId,
}: {
  category: Category;
  editor: MenuEditor;
  currency: string;
  onEditDish: (id: string) => void;
  highlightId: string | null;
}) {
  const { t } = useI18n();
  const sensors = useDragSensors();
  const items = editor.itemsIn(category.id);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const next = arrayMove(
      ids,
      ids.indexOf(String(active.id)),
      ids.indexOf(String(over.id)),
    );
    void editor.reorderItems(category.id, next);
  };

  const remove = () => {
    if (
      items.length > 0 &&
      !window.confirm(
        fill(t.editor.category.deleteConfirm, {
          name: category.name,
          count: items.length,
        }),
      )
    )
      return;
    void editor.deleteCategory(category.id);
  };

  const saveName = () => {
    setRenaming(false);
    const value = name.trim();
    if (!value) return setName(category.name);
    void editor.updateCategory(category.id, value);
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-card bg-surface shadow-card px-3 pt-2 pb-3 sm:px-4 ${isDragging ? "relative z-20" : ""}`}
    >
      <div className="border-line flex items-center gap-1 border-b pb-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="text-ink-muted grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center"
          aria-label={fill(t.editor.category.drag, { name: category.name })}
        >
          <GripVertical className="size-5" aria-hidden="true" />
        </button>
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setName(category.name);
                setRenaming(false);
              }
            }}
            maxLength={120}
            aria-label={fill(t.editor.category.rename, { name: category.name })}
            className="input font-display min-w-0 flex-1 text-xl font-semibold"
          />
        ) : (
          <h2 className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                setName(category.name);
                setRenaming(true);
              }}
              className="font-display min-h-11 w-full text-left text-2xl font-semibold"
              aria-label={fill(t.editor.category.rename, {
                name: category.name,
              })}
            >
              {category.name}
            </button>
          </h2>
        )}
        <button
          type="button"
          onClick={remove}
          className="text-ink-muted hover:bg-paprika-50 hover:text-danger grid size-11 shrink-0 place-items-center rounded-full"
          aria-label={`${t.editor.category.delete}: ${category.name}`}
          title={t.editor.category.delete}
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="divide-line divide-y">
            {items.map((item) => (
              <DishRow
                key={item.id}
                item={item}
                currency={currency}
                editor={editor}
                onEdit={() => onEditDish(item.id)}
                highlighted={highlightId === item.id}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="pt-1 pl-1">
        <InlineAdd
          label={t.editor.addDish}
          placeholder={t.editor.dishName}
          onAdd={async (dishName) => {
            const id = await editor.addItem(category.id, dishName);
            if (id) onEditDish(id);
          }}
        />
      </div>
    </section>
  );
}
