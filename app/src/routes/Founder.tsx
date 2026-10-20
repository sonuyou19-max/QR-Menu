// AI cost per restaurant per month, for the founder only (CLAUDE.md 10 step 15), not for
// restaurant owners: founder_ai_costs() answers null for anyone else. Split by job, compared with
// the €30 plan, plus the marketing site's "Try your own menu" demo as its own line.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fill, useI18n } from "../i18n";
import { supabase } from "../lib/supabase";

const PLAN_EUR = 30;
const kinds = [
  "extract",
  "translate",
  "chat",
  "theme",
  "dish",
  "demo",
] as const;

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

export function Founder() {
  const { t, lang } = useI18n();
  const T = t.founder;
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
      <h1 className="text-3xl font-semibold sm:text-4xl">{T.title}</h1>
      <p className="text-ink-muted mt-2">{T.intro}</p>

      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          aria-label={T.previous}
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
          aria-label={T.next}
          className="rounded-control border-line grid size-11 place-items-center border disabled:opacity-40"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      {data === undefined ? (
        <div className="bg-surface-muted rounded-card mt-6 h-40 animate-pulse" />
      ) : data === null ? (
        <p className="text-danger mt-6">{T.notAllowed}</p>
      ) : (
        <>
          <div className="rounded-card bg-surface shadow-card mt-6 p-4">
            <p className="text-ink-muted text-sm">{T.total}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {eur(total)}
            </p>
          </div>

          {data.rows.length === 0 ? (
            <p className="text-ink-muted mt-6">{T.none}</p>
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
                        {row.restaurant_id ? row.name : T.demoLine}
                      </p>
                      <p className="font-semibold tabular-nums">
                        {eur(row.eur)}
                      </p>
                    </div>
                    {row.restaurant_id && (
                      <>
                        <p className="text-ink-muted mt-0.5 text-sm">
                          {fill(T.ofPlan, {
                            percent: (share * 100).toLocaleString(lang, {
                              maximumFractionDigits: share < 0.1 ? 1 : 0,
                            }),
                          })}
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
                          <th className="py-1 font-normal">{T.job}</th>
                          <th className="py-1 text-right font-normal">
                            {T.calls}
                          </th>
                          <th className="py-1 text-right font-normal">
                            {T.tokens}
                          </th>
                          <th className="py-1 text-right font-normal">
                            {T.cost}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {kinds.map((kind) => {
                          const k = row.kinds[kind];
                          if (!k) return null;
                          return (
                            <tr key={kind} className="border-line border-t">
                              <td className="py-1.5">{T.kinds[kind]}</td>
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
                      <p className="text-danger mt-2 text-sm">{T.unpriced}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <details className="text-ink-muted mt-6 text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              {T.pricesTitle}
            </summary>
            <ul className="mt-1 space-y-1">
              {data.prices.map((p) => (
                <li key={p.model}>
                  {fill(T.priceLine, {
                    model: p.model,
                    input: p.input,
                    output: p.output,
                  })}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              {fill(T.pricesNote, { rate: data.usd_to_eur })}
            </p>
          </details>
        </>
      )}
    </div>
  );
}
