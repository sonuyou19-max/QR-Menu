// AI cost per restaurant per month (CLAUDE.md 10 step 15), split by job, compared with the €30
// plan, plus the marketing site's "Try your own menu" demo as its own line. founder_ai_costs()
// answers null for anyone who is not a founder.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "./supabase";

const lang = "en-GB";
const PLAN_EUR = 30;
const kinds = [
  "extract",
  "translate",
  "chat",
  "theme",
  "dish",
  "demo",
] as const;
const kindNames: Record<(typeof kinds)[number], string> = {
  extract: "Reading menus",
  translate: "Translating",
  chat: "Guest chat",
  theme: "Look suggestions",
  dish: "Dish suggestions",
  demo: "Demo previews",
};

interface Costs {
  month: string;
  usd_to_eur: number;
  prices: { model: string; input: number; output: number }[];
  rows: {
    restaurant_id: string | null;
    name: string | null;
    slug: string | null;
    plan: string | null;
    eur: number;
    unpriced: boolean;
    kinds: Partial<
      Record<
        (typeof kinds)[number],
        {
          calls: number;
          input_tokens: number;
          output_tokens: number;
          eur: number;
        }
      >
    >;
  }[];
}

const monthStart = (offset: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export function AiCosts() {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Costs | null | undefined>(undefined);

  useEffect(() => {
    setData(undefined);
    void supabase
      .rpc("founder_ai_costs", { p_month: monthStart(offset) })
      .then(({ data: result, error }) =>
        setData(error ? null : (result as unknown as Costs | null)),
      );
  }, [offset]);

  const eur = (n: number) =>
    n.toLocaleString(lang, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: n > 0 && n < 0.1 ? 3 : 2,
    });
  const monthName = new Date(
    `${monthStart(offset)}T12:00:00`,
  ).toLocaleDateString(lang, { month: "long", year: "numeric" });
  const total = data?.rows.reduce((sum, r) => sum + r.eur, 0) ?? 0;

  return (
    <div>
      <h1 className="text-3xl font-semibold sm:text-4xl">AI costs</h1>
      <p className="text-ink-muted mt-2">
        What the AI cost per restaurant this month, compared with the €30 plan.
      </p>

      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Previous month"
          className="rounded-control border-line grid size-11 place-items-center border"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <p className="min-w-40 text-center font-semibold capitalize">
          {monthName}
        </p>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset === 0}
          aria-label="Next month"
          className="rounded-control border-line grid size-11 place-items-center border disabled:opacity-40"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      {data === undefined ? (
        <div className="bg-surface-muted rounded-card mt-6 h-40 animate-pulse" />
      ) : data === null ? (
        <p className="text-danger mt-6">Couldn't load the numbers.</p>
      ) : (
        <>
          <div className="rounded-card bg-surface shadow-card mt-6 p-4">
            <p className="text-ink-muted text-sm">Total AI cost this month</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {eur(total)}
            </p>
          </div>

          {data.rows.length === 0 ? (
            <p className="text-ink-muted mt-6">No AI use in this month.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.rows.map((row) => {
                const share = row.eur / PLAN_EUR;
                return (
                  <li
                    key={row.restaurant_id ?? "demo"}
                    className="rounded-card bg-surface shadow-card p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate font-semibold">
                        {row.restaurant_id ? row.name : "Website demo"}
                      </p>
                      <p className="font-semibold tabular-nums">
                        {eur(row.eur)}
                      </p>
                    </div>
                    {row.restaurant_id && (
                      <>
                        <p className="text-ink-muted mt-0.5 text-sm">
                          {(share * 100).toLocaleString(lang, {
                            maximumFractionDigits: share < 0.1 ? 1 : 0,
                          })}
                          % of the €30 plan
                        </p>
                        <span
                          className="bg-surface-muted mt-2 block h-1.5 rounded-full"
                          aria-hidden="true"
                        >
                          <span
                            className={`block h-full rounded-full ${share > 0.5 ? "bg-danger" : "bg-brand"}`}
                            style={{
                              width: `${Math.min(100, Math.max(share * 100, 1))}%`,
                            }}
                          />
                        </span>
                      </>
                    )}
                    <table className="mt-3 w-full text-sm">
                      <thead className="text-ink-muted text-left text-xs">
                        <tr>
                          <th className="py-1 font-normal">Job</th>
                          <th className="py-1 text-right font-normal">Calls</th>
                          <th className="py-1 text-right font-normal">
                            Tokens
                          </th>
                          <th className="py-1 text-right font-normal">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {kinds.map((kind) => {
                          const k = row.kinds[kind];
                          if (!k) return null;
                          return (
                            <tr key={kind} className="border-line border-t">
                              <td className="py-1.5">{kindNames[kind]}</td>
                              <td className="py-1.5 text-right">
                                {k.calls.toLocaleString(lang)}
                              </td>
                              <td className="py-1.5 text-right">
                                {(
                                  k.input_tokens + k.output_tokens
                                ).toLocaleString(lang)}
                              </td>
                              <td className="py-1.5 text-right">
                                {eur(k.eur)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {row.unpriced && (
                      <p className="text-danger mt-2 text-sm">
                        Some calls used a model without a price: their cost is
                        not counted.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <details className="text-ink-muted mt-6 text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              Prices used
            </summary>
            <ul className="mt-1 space-y-1">
              {data.prices.map((p) => (
                <li key={p.model}>
                  {p.model}: ${p.input} in / ${p.output} out per million tokens
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Converted at $1 = €{data.usd_to_eur}. Change prices in the
              Supabase SQL editor (table private.ai_prices).
            </p>
          </details>
        </>
      )}
    </div>
  );
}
