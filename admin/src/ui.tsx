// Small building blocks for HQ: cards, number tiles, badges and two one-colour charts.
import { useState, type ReactNode } from "react";
import { date, num, stageLabels, type Stage } from "./lib";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card bg-surface shadow-card p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && (
            <h2 className="font-sans text-base font-semibold">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A headline number with one line of context underneath. */
export function Tile({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: ReactNode | undefined;
  trend?: string | null;
}) {
  return (
    <div className="rounded-card bg-surface shadow-card p-4">
      <p className="text-ink-muted text-sm leading-snug">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        {trend && (
          <span
            className={`text-sm font-semibold ${
              trend.startsWith("−") ? "text-danger" : "text-herb-800"
            }`}
          >
            {trend}
          </span>
        )}
      </p>
      {sub && <p className="text-ink-muted mt-1 text-sm">{sub}</p>}
    </div>
  );
}

const stageStyles: Record<Stage, string> = {
  live: "bg-herb-100 text-herb-800",
  quiet: "bg-mustard-100 text-mustard-800",
  setup: "bg-oat-100 text-oat-700",
};
export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge className={stageStyles[stage]}>{stageLabels[stage]}</Badge>;
}

export function Badge({
  children,
  className = "bg-oat-100 text-oat-700",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function Loading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="bg-surface-muted rounded-card h-24 animate-pulse" />
      <div className="bg-surface-muted rounded-card h-40 animate-pulse" />
    </div>
  );
}

export function Failed() {
  return (
    <p className="text-danger">Couldn't load this. Pull down to refresh.</p>
  );
}

/** Guest visits per day: one series, thin bars; tap a day to read its number. */
export function DayBars({ days }: { days: { day: string; visits: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.visits));
  const [picked, setPicked] = useState(days.length - 1);
  const shown = days[Math.min(picked, days.length - 1)];
  const label = (d: { day: string; visits: number }) =>
    `${date(`${d.day}T12:00:00`)}: ${num(d.visits)} visit${d.visits === 1 ? "" : "s"}`;
  return (
    <figure>
      {shown && (
        <figcaption
          className="text-ink-muted text-right text-sm tabular-nums"
          aria-live="polite"
        >
          {label(shown)}
        </figcaption>
      )}
      <div className="border-line mt-2 flex h-28 items-end gap-0.5 border-b">
        {days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setPicked(i)}
            aria-label={label(d)}
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
        <span>{days[0] && date(`${days[0].day}T12:00:00`)}</span>
        <span>Today</span>
      </div>
    </figure>
  );
}

/** Ranked rows with a bar each, in one colour (values printed beside every bar). */
export function RankBars({
  rows,
  format = num,
  empty = "Nothing yet",
}: {
  rows: {
    key: string;
    label: ReactNode;
    value: number;
    sub?: ReactNode | undefined;
    href?: string | undefined;
  }[];
  format?: (n: number) => string;
  empty?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  if (rows.length === 0)
    return <p className="text-ink-muted text-sm">{empty}</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="font-semibold tabular-nums">
                {format(r.value)}
              </span>
            </div>
            <span
              className="bg-surface-muted mt-1 block h-1.5 rounded-full"
              aria-hidden="true"
            >
              <span
                className="bg-brand block h-full rounded-full"
                style={{
                  width: `${Math.max((r.value / max) * 100, r.value ? 2 : 0)}%`,
                }}
              />
            </span>
            {r.sub && <p className="text-ink-muted mt-1 text-xs">{r.sub}</p>}
          </>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <a href={r.href} className="block">
                {content}
              </a>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
