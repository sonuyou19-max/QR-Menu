import { useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { fill, useI18n } from "../i18n";
import { moneyFormat, parsePrice } from "../lib/price";
import type { MenuEditor } from "./useMenuEditor";

/** Spreadsheet-style price list: type new prices, see what changes, apply them in one go. */
export function BulkPrices({
  editor,
  currency,
}: {
  editor: MenuEditor;
  currency: string;
}) {
  const { t, lang } = useI18n();
  const money = moneyFormat(lang, currency);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const categories = editor.categories ?? [];

  const parsed = Object.entries(drafts)
    .filter(([, text]) => text.trim() !== "")
    .map(([id, text]) => ({ id, price: parsePrice(text) }));
  const invalid = new Set(
    parsed.filter((p) => p.price === undefined).map((p) => p.id),
  );
  const changes = parsed
    .filter(
      (p): p is { id: string; price: number } => typeof p.price === "number",
    )
    .filter((p) => editor.items.find((i) => i.id === p.id)?.price !== p.price);

  const apply = async () => {
    setApplying(true);
    const ok = await editor.setPrices(changes);
    setApplying(false);
    if (ok) setDrafts({});
  };

  return (
    <div>
      <p className="text-ink-muted">{t.editor.prices.intro}</p>
      <div className="mt-4 space-y-6">
        {categories.map((category) => {
          const items = editor.itemsIn(category.id);
          if (!items.length) return null;
          return (
            <table
              key={category.id}
              className="rounded-card bg-surface shadow-card w-full overflow-hidden"
            >
              <caption className="font-display px-1 pb-2 text-left text-xl font-semibold">
                {category.name}
              </caption>
              <thead className="bg-oat-100 text-ink-muted text-left text-sm">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    <span className="sr-only">{t.editor.dishName}</span>
                  </th>
                  <th
                    scope="col"
                    className="w-24 px-2 py-2 text-right font-semibold"
                  >
                    {t.editor.prices.current}
                  </th>
                  <th scope="col" className="w-28 px-3 py-2 font-semibold">
                    {t.editor.prices.new}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {item.name}
                    </th>
                    <td
                      className={`px-2 py-2 text-right tabular-nums ${
                        item.price === null ? "text-danger text-sm" : ""
                      }`}
                    >
                      {item.price === null ? "—" : money.format(item.price)}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        inputMode="decimal"
                        value={drafts[item.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [item.id]: e.target.value,
                          }))
                        }
                        aria-label={fill(t.editor.prices.newFor, {
                          name: item.name,
                        })}
                        aria-invalid={invalid.has(item.id) || undefined}
                        className="input w-24 px-2.5 py-2 text-right tabular-nums"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>

      <div className="bg-canvas/95 border-line sticky bottom-0 -mx-4 mt-6 border-t px-4 py-3 backdrop-blur">
        {invalid.size > 0 && (
          <p
            role="alert"
            className="text-danger mb-2 flex gap-2 text-sm font-medium"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {t.editor.prices.invalid}
          </p>
        )}
        {changes.length > 0 && (
          <details className="mb-2">
            <summary className="cursor-pointer font-medium">
              {fill(t.editor.prices.summary, { count: changes.length })}
            </summary>
            <ul className="text-ink-muted mt-1 space-y-0.5 text-sm">
              {changes.map(({ id, price }) => {
                const item = editor.items.find((i) => i.id === id);
                return (
                  <li key={id}>
                    {item?.name}:{" "}
                    {item?.price === null || item?.price === undefined
                      ? "—"
                      : money.format(item.price)}{" "}
                    →{" "}
                    <strong className="text-ink">{money.format(price)}</strong>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
        <button
          type="button"
          disabled={changes.length === 0 || invalid.size > 0 || applying}
          onClick={() => void apply()}
          className="btn-primary w-full"
        >
          <Check className="size-5" aria-hidden="true" />
          {changes.length
            ? `${t.editor.prices.apply} (${changes.length})`
            : t.editor.prices.nothing}
        </button>
      </div>
    </div>
  );
}
