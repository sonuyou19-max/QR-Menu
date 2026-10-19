import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Camera,
  Info,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { fill, useI18n } from "../i18n";
import { allergenCodes } from "../lib/extraction";
import { parsePrice, priceInputValue } from "../lib/price";
import {
  dishImageUrl,
  removeDishPhotoFiles,
  uploadDishPhoto,
} from "./dishPhoto";
import type { Category, Item, MenuEditor } from "./useMenuEditor";

const dietaryKeys = [
  "vegetarian",
  "vegan",
  "contains_pork",
  "contains_beef",
  "contains_alcohol",
  "spicy",
] as const;
type Dietary = Partial<Record<(typeof dietaryKeys)[number], boolean>>;

/** All fields of one dish. Bottom sheet on phones, side panel on wider screens. Autosaves. */
export function DishSheet({
  item,
  categories,
  restaurantId,
  editor,
  showAllergens,
  startAtAllergens = false,
  onNextToConfirm,
  onClose,
}: {
  item: Item;
  categories: Category[];
  restaurantId: string;
  editor: MenuEditor;
  /** The restaurant shows allergens to guests; when false the allergen section is hidden. */
  showAllergens: boolean;
  /** Opened from "Start confirming": scroll straight to the allergens. */
  startAtAllergens?: boolean;
  /** Open the next dish whose allergens still need confirming (null when this is the last). */
  onNextToConfirm: (() => void) | null;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const ids = {
    name: useId(),
    price: useId(),
    category: useId(),
    description: useId(),
  };
  const dialogRef = useRef<HTMLDialogElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(priceInputValue(item.price, lang));
  const [priceInvalid, setPriceInvalid] = useState(false);
  const [description, setDescription] = useState(item.menu_description ?? "");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const dietary = (item.dietary ?? {}) as Dietary;
  const photo = dishImageUrl(item.image_path);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    if (startAtAllergens)
      document
        .getElementById(`${ids.name}-allergens`)
        ?.scrollIntoView({ block: "start" });
    // Only when the sheet opens.
  }, []);

  const saveName = () => {
    const value = name.trim();
    if (!value) return setName(item.name);
    if (value !== item.name) void editor.updateItem(item.id, { name: value });
  };
  const savePrice = () => {
    const parsed = parsePrice(price);
    if (parsed === undefined) return setPriceInvalid(true);
    if (parsed !== item.price)
      void editor.updateItem(item.id, { price: parsed });
  };
  const saveDescription = () => {
    const value = description.trim() || null;
    if (value !== item.menu_description)
      void editor.updateItem(item.id, { menu_description: value });
  };
  // Save what's typed even when the sheet is closed without leaving the field first.
  const saveTyped = () => {
    saveName();
    if (parsePrice(price) !== undefined) savePrice();
    saveDescription();
  };
  const close = () => {
    saveTyped();
    onClose();
  };

  const setPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(false);
    const paths = await uploadDishPhoto(restaurantId, item.id, file);
    setPhotoBusy(false);
    if (!paths) return setPhotoError(true);
    const old = [item.image_path, item.image_thumb_path];
    await editor.updateItem(item.id, paths, { quiet: true });
    void removeDishPhotoFiles(old);
  };
  const removePhoto = async () => {
    const old = [item.image_path, item.image_thumb_path];
    await editor.updateItem(
      item.id,
      { image_path: null, image_thumb_path: null },
      { quiet: true },
    );
    void removeDishPhotoFiles(old);
  };

  const toggleAllergen = (code: string) => {
    const next = item.allergens.includes(code)
      ? item.allergens.filter((a) => a !== code)
      : [...item.allergens, code];
    void editor.updateItem(item.id, { allergens: next });
  };
  const confirmed = item.allergen_status === "confirmed";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby={`${ids.name}-title`}
      className="bg-canvas text-ink m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-[1.5rem] p-0 shadow-2xl backdrop:bg-black/40 sm:mt-0 sm:ml-auto sm:h-dvh sm:max-h-dvh sm:w-[30rem] sm:rounded-none sm:rounded-l-[1.5rem]"
    >
      <div className="bg-canvas/95 border-line sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-2 backdrop-blur">
        <h2 id={`${ids.name}-title`} className="min-w-0 flex-1">
          <span className="text-ink-muted block font-sans text-sm font-medium">
            {t.editor.sheet.title}
          </span>
          <span className="block truncate text-xl font-semibold">
            {item.name}
          </span>
        </h2>
        <button
          type="button"
          onClick={close}
          className="bg-surface border-line grid size-11 place-items-center rounded-full border"
          aria-label={t.editor.sheet.close}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-6 px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* Photo */}
        <Field label={t.editor.sheet.photo}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void setPhoto(e.dataTransfer.files[0]);
            }}
            className="rounded-card bg-oat-100 relative overflow-hidden"
          >
            {photo ? (
              <img
                src={photo}
                alt={fill(t.editor.dish.photo, { name: item.name })}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-ink-muted flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 p-4 text-center"
              >
                <Camera className="size-8" aria-hidden="true" />
                {t.editor.sheet.photoEmpty}
              </button>
            )}
            {photoBusy && (
              <div className="bg-canvas/80 absolute inset-0 grid place-items-center font-medium">
                <span className="flex items-center gap-2">
                  <LoaderCircle
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                  {t.editor.sheet.photoUploading}
                </span>
              </div>
            )}
          </div>
          {photo && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
                className="btn-secondary"
              >
                {t.editor.sheet.photoChange}
              </button>
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => void removePhoto()}
                className="btn-secondary"
              >
                {t.editor.sheet.photoRemove}
              </button>
            </div>
          )}
          {photoError && (
            <p role="alert" className="text-danger mt-1.5 text-sm font-medium">
              {t.editor.sheet.photoError}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void setPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </Field>

        <div>
          <label htmlFor={ids.name} className="block font-semibold">
            {t.editor.sheet.name}
          </label>
          <p className="text-ink-muted text-sm">{t.editor.sheet.nameHint}</p>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            maxLength={200}
            className="input mt-1.5 text-lg font-semibold"
          />
        </div>

        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <div>
            <label htmlFor={ids.price} className="block font-semibold">
              {t.editor.sheet.price}
            </label>
            <input
              id={ids.price}
              inputMode="decimal"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceInvalid(false);
              }}
              onBlur={savePrice}
              aria-invalid={priceInvalid || undefined}
              aria-describedby={priceInvalid ? `${ids.price}-error` : undefined}
              className="input mt-1.5 tabular-nums"
            />
          </div>
          <div>
            <label htmlFor={ids.category} className="block font-semibold">
              {t.editor.sheet.category}
            </label>
            <select
              id={ids.category}
              value={item.category_id ?? ""}
              onChange={(e) => {
                const target = e.target.value;
                const ids = [
                  ...editor.itemsIn(target).map((i) => i.id),
                  item.id,
                ];
                void editor.reorderItems(target, ids);
              }}
              className="input mt-1.5"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {priceInvalid && (
            <p
              id={`${ids.price}-error`}
              role="alert"
              className="text-danger col-span-2 -mt-1 text-sm font-medium"
            >
              {t.editor.dish.invalidPrice}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={ids.description} className="block font-semibold">
            {t.editor.sheet.description}
          </label>
          <p className="text-ink-muted text-sm">
            {t.editor.sheet.descriptionHint}
          </p>
          <textarea
            id={ids.description}
            ref={descriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            rows={3}
            maxLength={1000}
            className="input mt-1.5"
          />
          {item.confidence === "unknown" && !item.menu_description && (
            <p className="text-mustard-800 mt-1.5 text-sm font-medium">
              {t.editor.sheet.unknown}
            </p>
          )}
        </div>

        {item.typical_description && !item.menu_description && (
          <div className="rounded-card bg-oat-100 p-4">
            <p className="flex items-center gap-1.5 font-semibold">
              <Info className="size-4" aria-hidden="true" />
              {t.editor.sheet.typical}
            </p>
            <p className="text-ink-muted text-sm">
              {t.editor.sheet.typicalHint}
            </p>
            <p
              className={`mt-2 italic ${item.show_typical_description ? "" : "text-ink-muted line-through"}`}
            >
              {item.typical_description}
            </p>
            {!item.show_typical_description && (
              <p className="text-ink-muted mt-1 text-sm">
                {t.editor.sheet.typicalHidden}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = item.typical_description ?? "";
                  setDescription(text);
                  void editor.updateItem(item.id, { menu_description: text });
                  requestAnimationFrame(() => descriptionRef.current?.focus());
                }}
                className="btn-secondary"
              >
                {t.editor.sheet.typicalUse}
              </button>
              <button
                type="button"
                onClick={() =>
                  void editor.updateItem(item.id, {
                    show_typical_description: !item.show_typical_description,
                  })
                }
                className="btn-secondary"
              >
                {item.show_typical_description
                  ? t.editor.sheet.typicalHide
                  : t.editor.sheet.typicalShow}
              </button>
            </div>
          </div>
        )}

        <Field label={t.editor.sheet.dietary}>
          <div className="flex flex-wrap gap-2">
            {dietaryKeys.map((key) => (
              <Chip
                key={key}
                checked={!!dietary[key]}
                onClick={() =>
                  void editor.updateItem(item.id, {
                    dietary: { ...dietary, [key]: !dietary[key] },
                  })
                }
              >
                {t.dietary[key]}
              </Chip>
            ))}
          </div>
        </Field>

        {showAllergens && (
          <div
            className={`rounded-card p-4 ${confirmed ? "bg-herb-50" : "bg-mustard-50"}`}
            id={`${ids.name}-allergens`}
          >
            <p className="font-semibold">{t.editor.sheet.allergens}</p>
            <p
              className={`mt-0.5 flex gap-1.5 text-sm ${confirmed ? "text-herb-800" : "text-mustard-900"}`}
            >
              {confirmed ? (
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <ShieldAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
              )}
              {confirmed
                ? t.editor.sheet.allergensConfirmed
                : t.editor.sheet.allergensSuggested}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {allergenCodes.map((code) => (
                <Chip
                  key={code}
                  checked={item.allergens.includes(code)}
                  onClick={() => toggleAllergen(code)}
                >
                  {t.allergens[code]}
                </Chip>
              ))}
            </div>
            {!confirmed && (
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void editor.updateItem(item.id, {
                      allergen_status: "confirmed",
                    })
                  }
                  className={onNextToConfirm ? "btn-secondary" : "btn-primary"}
                >
                  <ShieldCheck className="size-5" aria-hidden="true" />
                  {item.allergens.length
                    ? t.editor.sheet.confirm
                    : t.editor.sheet.confirmNone}
                </button>
                {onNextToConfirm && (
                  <button
                    type="button"
                    onClick={() => {
                      saveTyped();
                      void editor.updateItem(item.id, {
                        allergen_status: "confirmed",
                      });
                      onNextToConfirm();
                    }}
                    className="btn-primary"
                  >
                    <ShieldCheck className="size-5" aria-hidden="true" />
                    {t.editor.sheet.confirmNext}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <Switch
            checked={!item.is_hidden}
            onChange={(visible) =>
              void editor.updateItem(item.id, { is_hidden: !visible })
            }
          >
            {t.editor.sheet.visibility}
          </Switch>
          <Switch
            checked={item.in_stock}
            onChange={(inStock) =>
              void editor.updateItem(
                item.id,
                { in_stock: inStock },
                { quiet: true },
              )
            }
          >
            {t.editor.sheet.stock}
          </Switch>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            void editor.deleteItem(item.id);
          }}
          className="btn text-danger hover:bg-paprika-50 border-line w-full border"
        >
          <Trash2 className="size-5" aria-hidden="true" />
          {t.editor.sheet.delete}
        </button>
      </div>
    </dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{label}</legend>
      {children}
    </fieldset>
  );
}

function Chip({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 font-medium ${
        checked
          ? "border-herb-700 bg-herb-50 text-herb-800"
          : "border-line bg-surface text-ink"
      }`}
    >
      {checked && <Check className="size-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
      <span className="font-medium">{children}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="bg-oat-300 peer-checked:bg-herb-600 peer-focus-visible:outline-brand relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}
