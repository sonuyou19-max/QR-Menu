// "Today": is the business growing, and what needs the founder now. The attention list only
// shows groups that have something in them; with nothing to do it says so.
import { CircleCheck, ChevronRight } from "lucide-react";
import {
  ago,
  change,
  date,
  eur,
  num,
  useRpc,
  type AttentionGroup,
  type Overview,
} from "./lib";
import { Card, DayBars, Failed, Loading, Tile } from "./ui";

type Key = keyof Overview["attention"];
/** Items per group on this page; the rest are one tap away. */
const SHOWN = 3;

/** In order of urgency. `note` turns an item's note/date into its second line. */
const groups: {
  key: Key;
  title: string;
  link: (id: string) => string;
  more: string;
  note: (item: { note?: string | null; at?: string | null }) => string;
}[] = [
  {
    key: "flagged_answers",
    title: "Owners marked Buddy's answer as wrong",
    link: (id) => `#/r/${id}`,
    more: "#/restaurants",
    note: (i) => `“${i.note ?? ""}” · ${ago(i.at)}`,
  },
  {
    key: "failed_imports",
    title: "Menu import failed",
    link: (id) => `#/r/${id}`,
    more: "#/restaurants",
    note: (i) => `${importError(i.note)} · ${ago(i.at)}`,
  },
  {
    key: "translation_failed",
    title: "Translation failed",
    link: (id) => `#/r/${id}`,
    more: "#/restaurants",
    note: () => "Guests may see only the original menu",
  },
  {
    key: "new_leads",
    title: "New leads to contact",
    link: () => "#/leads",
    more: "#/leads",
    note: (i) => [i.note, `asked ${ago(i.at)}`].filter(Boolean).join(" · "),
  },
  {
    key: "trial_ending",
    title: "Pilot ends within 14 days",
    link: (id) => `#/r/${id}`,
    more: "#/restaurants?f=pilot",
    note: (i) => (i.at ? `Ends ${date(i.at)}` : ""),
  },
  {
    key: "stuck_setup",
    title: "Stuck in setup for 3+ days",
    link: (id) => `#/r/${id}`,
    more: "#/restaurants?f=setup",
    note: (i) =>
      `${i.note === "no_menu" ? "No menu yet" : "Menu not online yet"} · signed up ${ago(i.at)}`,
  },
  {
    key: "quiet",
    title: "Online, but no guests for 14 days",
    link: (id) => `#/r/${id}`,
    more: "#/restaurants?f=quiet",
    note: (i) => `Last guest ${ago(i.at)}`,
  },
  {
    key: "high_ai_cost",
    title: "AI cost above €9 this month",
    link: (id) => `#/r/${id}`,
    more: "#/costs",
    note: (i) => `${eur(Number(i.note ?? 0))} so far`,
  },
];

const importErrors: Record<string, string> = {
  not_a_menu: "Photos weren't a menu",
  unreadable: "Menu unreadable",
  no_menu_found: "No menu found on the website",
  site_unreachable: "Website unreachable",
  social_site: "Social media link",
  bad_url: "Bad web address",
  pdf_locked: "Locked PDF",
};
const importError = (code?: string | null) =>
  (code && importErrors[code]) || code || "Unknown error";

export function Today() {
  const { data } = useRpc<Overview>("hq_overview");
  if (data === undefined) return <Loading />;
  if (data === null) return <Failed />;
  const k = data.kpis;
  const open = groups.filter((g) => data.attention[g.key].count > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Monthly revenue"
          value={eur(k.mrr)}
          sub={`${num(k.paying)} paying · ${num(k.pilots)} pilot${k.pilots === 1 ? "" : "s"}`}
        />
        <Tile
          label="Restaurants online"
          value={num(k.live + k.quiet)}
          sub={`${num(k.setup)} setting up · ${num(k.new_this_month)} new this month`}
        />
        <Tile
          label="Guest visits, 7 days"
          value={num(k.visits_7d)}
          trend={change(k.visits_7d, k.visits_prev_7d)}
          sub={`${num(k.visits_prev_7d)} the week before`}
        />
        <Tile
          label="AI cost this month"
          value={eur(k.ai_eur_month)}
          sub={
            k.mrr > 0
              ? `${Math.round((k.ai_eur_month / k.mrr) * 100)}% of revenue`
              : "No revenue yet"
          }
        />
      </div>

      <section aria-labelledby="attention-title">
        <h2 id="attention-title" className="text-2xl font-semibold">
          Needs attention
        </h2>
        {open.length === 0 ? (
          <p className="rounded-card bg-surface shadow-card mt-3 flex items-center gap-3 p-4">
            <CircleCheck
              className="text-herb-700 size-6 shrink-0"
              aria-hidden="true"
            />
            All clear. Nothing needs you right now.
          </p>
        ) : (
          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            {open.map((g) => (
              <AttentionCard
                key={g.key}
                group={data.attention[g.key]}
                spec={g}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card
          title="Guest visits per day"
          action={
            <span className="text-ink-muted text-sm">all restaurants</span>
          }
        >
          <DayBars days={data.per_day} />
        </Card>
        <Card
          title="From lead to paying"
          action={<span className="text-ink-muted text-sm">all time</span>}
        >
          <Funnel funnel={data.funnel} />
        </Card>
      </div>
    </div>
  );
}

function AttentionCard({
  group,
  spec,
}: {
  group: AttentionGroup;
  spec: (typeof groups)[number];
}) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="bg-paprika-100 text-paprika-800 grid min-w-7 place-items-center rounded-full px-2 text-sm tabular-nums">
            {num(group.count)}
          </span>
          {spec.title}
        </span>
      }
    >
      <ul className="divide-line -my-1 divide-y">
        {group.items.slice(0, SHOWN).map((item, i) => (
          <li key={`${item.id}-${i}`}>
            <a
              href={spec.link(item.id)}
              className="flex min-h-12 items-center gap-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="text-ink-muted block truncate text-sm">
                  {spec.note(item)}
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
      {group.count > SHOWN && (
        <a
          href={spec.more}
          className="text-brand-strong mt-2 inline-flex min-h-11 items-center text-sm font-semibold"
        >
          See all {num(group.count)}
        </a>
      )}
    </Card>
  );
}

const funnelSteps: { key: keyof Overview["funnel"]; label: string }[] = [
  { key: "leads", label: "Asked for a demo" },
  { key: "signed_up", label: "Signed up" },
  { key: "menu_read", label: "Menu read by Buddy" },
  { key: "online", label: "Menu online" },
  { key: "guests", label: "Guests in the last 30 days" },
  { key: "paying", label: "Paying" },
];

/** Each step as a share of the widest step, with the step-to-step conversion beside it. */
function Funnel({ funnel }: { funnel: Overview["funnel"] }) {
  const max = Math.max(1, ...funnelSteps.map((s) => funnel[s.key]));
  return (
    <ol className="space-y-2.5">
      {funnelSteps.map((s, i) => {
        const value = funnel[s.key];
        const prev = i > 0 ? funnel[funnelSteps[i - 1]!.key] : null;
        return (
          <li key={s.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{s.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{num(value)}</span>
                {prev && value <= prev ? (
                  <span className="text-ink-muted ml-2 inline-block w-10 text-right">
                    {Math.round((value / prev) * 100)}%
                  </span>
                ) : (
                  <span className="ml-2 inline-block w-10" />
                )}
              </span>
            </div>
            <span
              className="bg-surface-muted mt-1 block h-2 rounded-full"
              aria-hidden="true"
            >
              <span
                className="bg-brand block h-full rounded-full"
                style={{
                  width: `${Math.max((value / max) * 100, value ? 2 : 0)}%`,
                }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
