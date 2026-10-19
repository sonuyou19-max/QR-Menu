import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  EyeOff,
  GripVertical,
  ImagePlus,
  Pencil,
  ShieldAlert,
} from "lucide-react";
import { fill, useI18n } from "../i18n";
import { dishImageUrl } from "./dishPhoto";
import { PriceField } from "./PriceField";
import type { Item, MenuEditor } from "./useMenuEditor";

/** One dish in the live editor: photo, name as on the menu, price, stock switch, edit button. */
export function DishRow({
  item,
  currency,
  editor,
  onEdit,
  highlighted,
  showAllergens,
}: {
  item: Item;
  currency: string;
  editor: MenuEditor;
  onEdit: () => void;
  highlighted: boolean;
  showAllergens: boolean;
}) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const thumb = dishImageUrl(item.image_thumb_path ?? item.image_path);
  const description =
    item.menu_description ||
    (item.show_typical_description ? item.typical_description : null);

  return (
    <li
      ref={setNodeRef}
      id={`dish-${item.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-surface flex items-start gap-2 py-3 pr-1 ${
        isDragging ? "shadow-card rounded-control relative z-10" : ""
      } ${highlighted ? "ring-mustard-400 rounded-control ring-2" : ""} ${
        item.is_hidden ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="text-ink-muted grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center"
        aria-label={fill(t.editor.dish.drag, { name: item.name })}
      >
        <GripVertical className="size-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="bg-oat-100 text-ink-muted rounded-control grid size-14 shrink-0 place-items-center overflow-hidden"
        aria-label={fill(thumb ? t.editor.dish.photo : t.editor.dish.photoAdd, {
          name: item.name,
        })}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImagePlus className="size-5" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 w-full text-left text-lg leading-snug font-semibold [overflow-wrap:anywhere]"
        >
          {item.name}
        </button>
        {description && (
          <p
            className={`text-ink-muted line-clamp-2 text-sm ${
              item.menu_description ? "" : "italic"
            }`}
          >
            {description}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <PriceField
            name={item.name}
            price={item.price}
            currency={currency}
            onSave={(price) => void editor.updateItem(item.id, { price })}
          />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              role="switch"
              checked={item.in_stock}
              onChange={(e) =>
                void editor.updateItem(
                  item.id,
                  { in_stock: e.target.checked },
                  { quiet: true },
                )
              }
              className="peer sr-only"
              aria-label={fill(t.editor.dish.stockLabel, { name: item.name })}
            />
            <span
              aria-hidden="true"
              className="bg-oat-300 peer-checked:bg-herb-600 peer-focus-visible:outline-brand relative h-7 w-12 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
            />
            <span
              className={`text-sm font-medium ${item.in_stock ? "text-herb-800" : "text-ink-muted"}`}
            >
              {item.in_stock ? t.editor.dish.inStock : t.editor.dish.outOfStock}
            </span>
          </label>
          {item.is_hidden && (
            <span className="bg-oat-100 text-oat-700 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
              <EyeOff className="size-3.5" aria-hidden="true" />
              {t.editor.dish.hiddenNote}
            </span>
          )}
          {showAllergens && item.allergen_status !== "confirmed" && (
            <button
              type="button"
              onClick={onEdit}
              className="bg-mustard-100 text-mustard-900 inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold"
            >
              <ShieldAlert className="size-3.5" aria-hidden="true" />
              {t.editor.dish.allergensToConfirm}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="text-ink-muted hover:bg-oat-100 grid size-11 shrink-0 place-items-center rounded-full"
        aria-label={fill(t.editor.dish.edit, { name: item.name })}
      >
        <Pencil className="size-5" aria-hidden="true" />
      </button>
    </li>
  );
}
