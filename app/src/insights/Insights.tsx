// "Your guests" on the overview (CLAUDE.md 3 owner flow 11): visits per day, totals, guest
// languages and the most opened / added dishes, from restaurant_insights(). Phone-first: the bar
// chart shows a day's number when tapped (no hover on a phone).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronRight, MessageCircleQuestion } from "lucide-react";
import { fill, useI18n } from "../i18n";
import { languageName } from "../lib/languages";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

interface Insights {
  days: number;
  per_day: { day: string; visits: number }[];
  totals: {
    visits: number;
    added: number;
    shown_to_staff: number;
    questions: number;
  };
  languages: { language: string; visits: number }[];
  top_viewed: { id: string; name: string; count: number }[];
  top_added: { id: string; name: string; count: number }[];
}

const periods = [7, 30] as const;

export function InsightsSection() {
  const { t, lang } = useI18n();
  const { restaurant } = useRestaurant();
  const T = t.insights;
  const [days, setDays] = useState<(typeof periods)[number]>(30);
  const [data, setData] = useState<Insights | null | undefined>(undefined);

  const load = useCallback(async () => {
    const { data: result, error } = await supabase.rpc("restaurant_insights", {
      p_restaurant: restaurant.id,
      p_days: days,
    });
    setData(error ? null : (result as unknown as Insights));
  }, [restaurant.id, days]);
  useEffect(() => {
    void load();
  }, [load]);

  const tiles =
    data &&
    ([
      [T.visits, data.totals.visits],
      [T.added, data.totals.added],
      [T.shownToStaff, data.totals.shown_to_staff],
      [T.questions, data.totals.questions],
    ] as const);
  const empty = data && data.totals.visits === 0 && data.totals.questions === 0;

  return (
    <section aria-labelledby="insights-title" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="insights-title" className="text-2xl font-semibold">
          {T.title}
        </h2>
        <div
          role="radiogroup"
          aria-label={T.period}
          className="rounded-control bg-surface-muted flex gap-1 p-1"
        >
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={days === p}
              onClick={() => setDays(p)}
              className={`rounded-control min-h-10 px-3 text-sm font-semibold ${
                days === p ? "bg-surface shadow-card" : "text-ink-muted"
              }`}
            >
              {fill(T.lastDays, { days: p })}
            </button>
          ))}
        </div>
      </div>

      {!restaurant.is_published ? (
        <p className="text-ink-muted mt-4">{T.notPublished}</p>
      ) : data === undefined ? (
        <div className="bg-surface-muted rounded-card mt-4 h-40 animate-pulse" />
      ) : data === null ? (
        <p className="text-danger mt-4">{T.loadFailed}</p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles!.map(([label, value]) => (
              <div
                key={label}
                className="rounded-card bg-surface shadow-card p-4"
              >
                <dt className="text-ink-muted text-sm leading-snug">{label}</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {value.toLocaleString(lang)}
                </dd>
              </div>
            ))}
          </dl>

          {empty ? (
            <p className="text-ink-muted mt-4">{T.empty}</p>
          ) : (
            <>
              <VisitsChart perDay={data.per_day} />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <RankList
                  title={T.languages}
                  rows={data.languages.map((l) => ({
                    key: l.language,
                    label: languageName(l.language, lang),
                    count: l.visits,
                  }))}
                />
                <RankList
                  title={T.topViewed}
                  rows={data.top_viewed.map((d) => ({
                    key: d.id,
                    label: d.name,
                    count: d.count,
                  }))}
                />
                <RankList
                  title={T.topAdded}
                  rows={data.top_added.map((d) => ({
                    key: d.id,
                    label: d.name,
                    count: d.count,
                  }))}
                />
              </div>
            </>
          )}
        </>
      )}

      <Link
        to="/questions"
        className="rounded-card bg-surface shadow-card hover:bg-oat-50 mt-4 flex items-center gap-3 p-4"
      >
        <MessageCircleQuestion
          className="text-brand-strong size-6 shrink-0"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{T.seeQuestions}</span>
          <span className="text-ink-muted block text-sm">
            {T.seeQuestionsText}
          </span>
        </span>
        <ChevronRight
          className="text-ink-muted size-5 shrink-0"
          aria-hidden="true"
        />
      </Link>
    </section>
  );
}

/** One series (menu visits): one hue, thin bars, a 2px gap; tap a day to read its number. */
function VisitsChart({ perDay }: { perDay: Insights["per_day"] }) {
  const { t, lang } = useI18n();
  const T = t.insights;
  const max = Math.max(1, ...perDay.map((d) => d.visits));
  const [picked, setPicked] = useState(perDay.length - 1);
  const day = (iso: string, style: "short" | "long") =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(lang, {
      weekday: style === "long" ? "short" : undefined,
      day: "numeric",
      month: "short",
    });
  const shown = perDay[Math.min(picked, perDay.length - 1)];

  return (
    <figure className="rounded-card bg-surface shadow-card mt-4 p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{T.perDay}</span>
        {shown && (
          <span
            className="text-ink-muted text-sm tabular-nums"
            aria-live="polite"
          >
            {fill(T.visitsOn, {
              date: day(shown.day, "long"),
              count: shown.visits,
            })}
          </span>
        )}
      </figcaption>
      <div className="border-line mt-3 flex h-32 items-end gap-0.5 border-b">
        {perDay.map((d, i) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setPicked(i)}
            aria-label={fill(T.visitsOn, {
              date: day(d.day, "long"),
              count: d.visits,
            })}
            aria-pressed={i === picked}
            className="group flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className={`block w-full rounded-t-[4px] ${
                i === picked
                  ? "bg-brand-strong"
                  : "bg-brand group-hover:bg-brand-strong"
              }`}
              style={{
                height: d.visits ? `${(d.visits / max) * 100}%` : "2px",
              }}
            />
          </button>
        ))}
      </div>
      <div className="text-ink-muted mt-1.5 flex justify-between text-xs">
        <span>{perDay[0] && day(perDay[0].day, "short")}</span>
        <span>{perDay.at(-1) && day(perDay.at(-1)!.day, "short")}</span>
      </div>
    </figure>
  );
}

function RankList({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; count: number }[];
}) {
  const { t, lang } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-card bg-surface shadow-card p-4">
      <h3 className="font-sans text-base font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-ink-muted mt-2 text-sm">{t.insights.noneYet}</p>
      ) : (
        <ol className="mt-2 space-y-2.5">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate" dir="auto">
                  {r.label}
                </span>
                <span className="font-semibold tabular-nums">
                  {r.count.toLocaleString(lang)}
                </span>
              </div>
              <span
                className="bg-surface-muted mt-1 block h-1.5 rounded-full"
                aria-hidden="true"
              >
                <span
                  className="bg-brand block h-full rounded-full"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
