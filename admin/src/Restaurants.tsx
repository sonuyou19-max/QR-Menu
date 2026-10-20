// Every restaurant in one searchable list: stage, plan, guests, questions and AI cost at a glance;
// tap one for the full picture. Built for hundreds of rows (filters and search run in the browser).
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import {
  ago,
  change,
  eur,
  num,
  planLabels,
  useRpc,
  type RestaurantRow,
} from "./lib";
import { Badge, Failed, Loading, StageBadge } from "./ui";

const filters = [
  { key: "all", label: "All", test: (r: RestaurantRow) => !r.is_demo },
  {
    key: "live",
    label: "Online",
    test: (r: RestaurantRow) => !r.is_demo && r.stage === "live",
  },
  {
    key: "quiet",
    label: "Quiet",
    test: (r: RestaurantRow) => !r.is_demo && r.stage === "quiet",
  },
  {
    key: "setup",
    label: "Setting up",
    test: (r: RestaurantRow) => !r.is_demo && r.stage === "setup",
  },
  {
    key: "pilot",
    label: "Pilot",
    test: (r: RestaurantRow) => !r.is_demo && r.plan === "pilot",
  },
  {
    key: "paying",
    label: "Paying",
    test: (r: RestaurantRow) => !r.is_demo && r.plan !== "pilot",
  },
  { key: "demo", label: "Demo", test: (r: RestaurantRow) => r.is_demo },
] as const;

const sorts = {
  newest: {
    label: "Newest",
    by: (a: RestaurantRow, b: RestaurantRow) =>
      b.created_at.localeCompare(a.created_at),
  },
  visits: {
    label: "Most guests",
    by: (a: RestaurantRow, b: RestaurantRow) => b.visits_7d - a.visits_7d,
  },
  cost: {
    label: "Highest AI cost",
    by: (a: RestaurantRow, b: RestaurantRow) => b.ai_eur_month - a.ai_eur_month,
  },
  name: {
    label: "Name",
    by: (a: RestaurantRow, b: RestaurantRow) => a.name.localeCompare(b.name),
  },
} as const;

const PAGE = 100;

export function Restaurants({
  initialFilter,
}: {
  initialFilter?: string | undefined;
}) {
  const { data } = useRpc<RestaurantRow[]>("hq_restaurants");
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>(
    filters.some((f) => f.key === initialFilter)
      ? (initialFilter as (typeof filters)[number]["key"])
      : "all",
  );
  const [sort, setSort] = useState<keyof typeof sorts>("newest");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const test = filters.find((f) => f.key === filter)!.test;
    return data
      .filter(test)
      .filter(
        (r) =>
          !q ||
          [r.name, r.slug, r.address, r.owner_email].some((v) =>
            v?.toLowerCase().includes(q),
          ),
      )
      .sort(sorts[sort].by);
  }, [data, filter, sort, query]);

  if (data === undefined) return <Loading />;
  if (data === null) return <Failed />;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search restaurants</span>
          <Search
            className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, town or owner email"
            className="input pl-10"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as keyof typeof sorts)}
            className="input w-auto py-2.5"
          >
            {Object.entries(sorts).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1"
        role="radiogroup"
        aria-label="Show"
      >
        {filters.map((f) => {
          const count = data.filter(f.test).length;
          return (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setLimit(PAGE);
              }}
              className={`min-h-10 shrink-0 rounded-full border px-3 text-sm font-semibold ${
                filter === f.key
                  ? "border-ink bg-ink text-canvas"
                  : "border-line bg-surface text-ink"
              }`}
            >
              {f.label}{" "}
              <span className="tabular-nums opacity-70">{num(count)}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-muted mt-6">No restaurants match.</p>
      ) : (
        <ul className="rounded-card bg-surface shadow-card divide-line mt-4 divide-y">
          {rows.slice(0, limit).map((r) => (
            <li key={r.id}>
              <a
                href={`#/r/${r.id}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold">{r.name}</span>
                    <StageBadge stage={r.stage} />
                    {r.is_demo ? (
                      <Badge>Demo</Badge>
                    ) : (
                      <Badge>{planLabels[r.plan]}</Badge>
                    )}
                  </span>
                  <span className="text-ink-muted mt-1 block text-sm tabular-nums">
                    {num(r.visits_7d)} guests this week
                    {change(r.visits_7d, r.visits_prev_7d) &&
                      ` (${change(r.visits_7d, r.visits_prev_7d)})`}
                    {" · "}
                    {num(r.questions_30d)} questions · AI {eur(r.ai_eur_month)}
                  </span>
                  <span className="text-ink-muted block truncate text-xs">
                    {r.stage === "setup"
                      ? `Signed up ${ago(r.created_at)}${r.dishes ? ` · ${num(r.dishes)} dishes read` : " · no menu yet"}`
                      : `Last guest ${ago(r.last_visit)}`}
                    {r.owner_email && ` · ${r.owner_email}`}
                  </span>
                </span>
                <ChevronRight
                  className="text-ink-muted size-4 shrink-0"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="btn-secondary mt-3 w-full"
        >
          Show more ({num(rows.length - limit)} left)
        </button>
      )}
    </div>
  );
}
