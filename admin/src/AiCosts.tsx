// AI cost per month (CLAUDE.md 10 step 15): the total against revenue, what it is spent on, and
// the most expensive restaurants. Per-restaurant detail lives on the restaurant's own page.
// founder_ai_costs() answers null for anyone who is not a founder.
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  eur,
  jobLabels,
  locale,
  num,
  PLAN_EUR,
  useRpc,
  type RestaurantRow,
} from "./lib";
import { Card, Failed, Loading, RankBars, Tile } from "./ui";

interface Costs {
  month: string;
  usd_to_eur: number;
  prices: { model: string; input: number; output: number }[];
  rows: {
    restaurant_id: string | null;
    name: string | null;
    eur: number;
    unpriced: boolean;
    kinds: Record<
      string,
      {
        calls: number;
        input_tokens: number;
        output_tokens: number;
        eur: number;
      }
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
  const { data } = useRpc<Costs>("founder_ai_costs", {
    p_month: monthStart(offset),
  });
  const { data: restaurants } = useRpc<RestaurantRow[]>("hq_restaurants");

  const monthName = new Date(
    `${monthStart(offset)}T12:00:00`,
  ).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const switcher = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOffset((o) => o - 1)}
        aria-label="Previous month"
        className="rounded-control border-line bg-surface grid size-11 place-items-center border"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <p className="min-w-36 text-center font-semibold">{monthName}</p>
      <button
        type="button"
        onClick={() => setOffset((o) => Math.min(0, o + 1))}
        disabled={offset === 0}
        aria-label="Next month"
        className="rounded-control border-line bg-surface grid size-11 place-items-center border disabled:opacity-40"
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );

  if (data === undefined)
    return (
      <div className="space-y-4">
        {switcher}
        <Loading />
      </div>
    );
  if (data === null)
    return (
      <div className="space-y-4">
        {switcher}
        <Failed />
      </div>
    );

  const total = data.rows.reduce((s, r) => s + r.eur, 0);
  const business = (restaurants ?? []).filter((r) => !r.is_demo);
  const revenue = business.reduce((s, r) => s + r.mrr, 0);
  const online = business.filter((r) => r.is_published).length;
  const byJob = new Map<string, number>();
  for (const r of data.rows)
    for (const [kind, k] of Object.entries(r.kinds))
      byJob.set(kind, (byJob.get(kind) ?? 0) + k.eur);
  const unpriced = data.rows.some((r) => r.unpriced);

  return (
    <div className="space-y-5">
      {switcher}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          label="AI cost"
          value={eur(total)}
          sub={offset === 0 ? "so far this month" : undefined}
        />
        <Tile
          label="Share of revenue"
          value={revenue > 0 ? `${Math.round((total / revenue) * 100)}%` : "–"}
          sub={
            revenue > 0
              ? `of ${eur(revenue)} a month`
              : "No paying restaurants yet"
          }
        />
        <Tile
          label="Per online restaurant"
          value={online ? eur(total / online) : "–"}
          sub={`${num(online)} online · plan is ${eur(PLAN_EUR)}`}
        />
      </div>
      {unpriced && (
        <p className="text-danger text-sm">
          Some calls used a model without a price, so their cost isn't counted.
          Add it in private.ai_prices.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Spent on">
          <RankBars
            rows={[...byJob.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([kind, value]) => ({
                key: kind,
                label: jobLabels[kind] ?? kind,
                value,
              }))}
            format={(n) => eur(n, true)}
            empty="No AI use this month"
          />
        </Card>
        <Card
          title="Most expensive"
          action={<span className="text-ink-muted text-sm">top 10</span>}
        >
          <RankBars
            rows={[...data.rows]
              .sort((a, b) => b.eur - a.eur)
              .slice(0, 10)
              .map((r) => ({
                key: r.restaurant_id ?? "demo",
                label: r.restaurant_id
                  ? r.name
                  : "Website demo (Try your own menu)",
                value: r.eur,
                href: r.restaurant_id ? `#/r/${r.restaurant_id}` : undefined,
                sub: r.restaurant_id
                  ? `${((r.eur / PLAN_EUR) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}% of the €30 plan`
                  : undefined,
              }))}
            format={(n) => eur(n, true)}
            empty="No AI use this month"
          />
        </Card>
      </div>

      <details className="text-ink-muted text-sm">
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
          Converted at $1 = €{data.usd_to_eur}. Change prices in the Supabase
          SQL editor (table private.ai_prices). Revenue is what the current
          plans add up to, excl. VAT.
        </p>
      </details>
    </div>
  );
}
