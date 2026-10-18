import { useState } from "react";
import { fill, useI18n } from "../i18n";
import { moneyFormat, parsePrice, priceInputValue } from "../lib/price";

/** Tap the price to change it; saves on Enter or when leaving the field. */
export function PriceField({
  name,
  price,
  currency,
  onSave,
}: {
  name: string;
  price: number | null;
  currency: string;
  onSave: (price: number | null) => void;
}) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  if (!editing)
    return (
      <button
        type="button"
        onClick={() => {
          setValue(priceInputValue(price, lang));
          setInvalid(false);
          setEditing(true);
        }}
        aria-label={fill(t.editor.dish.price, { name })}
        className={`min-h-11 shrink-0 rounded-full px-3 text-lg font-semibold tabular-nums ${
          price === null
            ? "bg-paprika-50 text-danger text-sm"
            : "hover:bg-oat-100 border-line border border-dashed"
        }`}
      >
        {price === null
          ? t.editor.dish.noPrice
          : moneyFormat(lang, currency).format(price)}
      </button>
    );

  const commit = () => {
    const parsed = parsePrice(value);
    if (parsed === undefined) return setInvalid(true);
    setEditing(false);
    if (parsed !== price) onSave(parsed);
  };

  return (
    <div className="shrink-0 text-right">
      <input
        autoFocus
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label={fill(t.editor.dish.price, { name })}
        aria-invalid={invalid || undefined}
        className="input w-28 text-right text-lg tabular-nums"
      />
      {invalid && (
        <p
          role="alert"
          className="text-danger mt-1 max-w-40 text-xs font-medium"
        >
          {t.editor.dish.invalidPrice}
        </p>
      )}
    </div>
  );
}
