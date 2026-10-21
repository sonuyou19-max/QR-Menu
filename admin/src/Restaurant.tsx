// One restaurant in full: who runs it, how guests use it, what Brisolo answered, how its menu
// imports went and what its AI cost this month (by job).
import { useState } from "react";
import { ArrowLeft, ExternalLink, Flag, Mail } from "lucide-react";
import { supabase } from "./supabase";
import {
  ago,
  appUrl,
  change,
  date,
  eur,
  jobLabels,
  languageName,
  num,
  planLabels,
  planText,
  sizeForSeats,
  sizeLabels,
  sizePrices,
  type Plan,
  type PlanSize,
  useRpc,
  type RestaurantDetail,
} from "./lib";
import {
  Badge,
  Card,
  DayBars,
  Failed,
  Loading,
  RankBars,
  StageBadge,
  Tile,
} from "./ui";

const answerTypes: Record<string, string> = {
  menu_fact: "From the menu",
  general_knowledge: "General knowledge",
  cannot_answer: "Referred to staff",
  off_topic: "Off topic",
  error: "No answer",
};

export function Restaurant({ id }: { id: string }) {
  const { data: r, reload } = useRpc<RestaurantDetail>("hq_restaurant", {
    p_id: id,
  });
  const back = (
    <a
      href="#/restaurants"
      className="text-ink-muted inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Restaurants
    </a>
  );
  if (r === undefined) return <Loading />;
  if (r === null)
    return (
      <div>
        {back}
        <Failed />
      </div>
    );
  const planPrice = sizePrices[r.plan_size];
  const share = r.ai_eur_month / planPrice;

  return (
    <div className="space-y-5">
      <div>
        {back}
        <h1 className="mt-1 text-3xl font-semibold">{r.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <StageBadge stage={r.stage} />
          <Badge>{r.is_demo ? "Demo" : planText(r)}</Badge>
          {r.trial_ends_at && r.plan === "pilot" && (
            <Badge>Pilot ends {date(r.trial_ends_at)}</Badge>
          )}
          {r.translation_failed && (
            <Badge className="bg-paprika-100 text-paprika-800">
              Translation failed
            </Badge>
          )}
        </p>
        <dl className="text-ink-muted mt-3 space-y-1 text-sm">
          {r.address && <div>{r.address}</div>}
          <div>
            Signed up {date(r.created_at)}
            {r.published_at && ` · online since ${date(r.published_at)}`}
            {` · ${num(r.dishes)} dishes · menu in ${languageName(r.source_language)}`}
          </div>
          <div>
            Guest languages: {r.guest_languages.map(languageName).join(", ")}
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {r.members.map((m) => (
            <a
              key={m.email}
              href={`mailto:${m.email}`}
              className="btn-secondary min-h-11 px-3 py-2 text-sm"
            >
              <Mail className="size-4" aria-hidden="true" />
              {m.email}
              {m.role !== "owner" && (
                <span className="text-ink-muted">({m.role})</span>
              )}
            </a>
          ))}
          <a
            href={`${appUrl}/m/${r.slug}`}
            target="_blank"
            rel="noopener"
            className="btn-secondary min-h-11 px-3 py-2 text-sm"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Guest menu
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Guests, 7 days"
          value={num(r.visits_7d)}
          trend={change(r.visits_7d, r.visits_prev_7d)}
          sub={`Last guest ${ago(r.last_visit)}`}
        />
        <Tile label="Guests, 30 days" value={num(r.visits_30d)} />
        <Tile
          label="Questions, 30 days"
          value={num(r.questions_30d)}
          sub={r.flagged_30d ? `${num(r.flagged_30d)} marked wrong` : undefined}
        />
        <Tile
          label="AI cost this month"
          value={eur(r.ai_eur_month)}
          sub={`${(share * 100).toLocaleString("en-GB", { maximumFractionDigits: share < 0.1 ? 1 : 0 })}% of the ${sizeLabels[r.plan_size]} plan (${eur(planPrice)})`}
        />
      </div>

      {!r.is_demo && <PlanCard r={r} onSaved={() => void reload()} />}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Guest visits per day">
          <DayBars days={r.per_day} />
        </Card>
        <Card
          title="Guest languages"
          action={<span className="text-ink-muted text-sm">30 days</span>}
        >
          <RankBars
            rows={r.languages.map((l) => ({
              key: l.language,
              label: languageName(l.language),
              value: l.visits,
            }))}
            empty="No guests yet"
          />
        </Card>
      </div>

      <Card
        title="Guest questions"
        action={
          <span className="text-ink-muted text-sm">wrong ones first</span>
        }
      >
        {r.questions.length === 0 ? (
          <p className="text-ink-muted text-sm">No questions yet.</p>
        ) : (
          <ul className="divide-line -my-2 divide-y">
            {r.questions.map((q, i) => (
              <li key={i} className="py-3">
                <p className="text-ink-muted flex flex-wrap items-center gap-x-2 text-xs">
                  {q.flagged && (
                    <span className="text-danger inline-flex items-center gap-1 font-semibold">
                      <Flag className="size-3" aria-hidden="true" />
                      Marked wrong
                    </span>
                  )}
                  {ago(q.at)} · {languageName(q.language)} ·{" "}
                  {answerTypes[q.type] ?? q.type}
                </p>
                <p className="mt-1 font-medium" dir="auto">
                  {q.question}
                </p>
                <p className="text-ink-muted mt-0.5 text-sm" dir="auto">
                  {q.answer}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card
          title="AI cost by job"
          action={<span className="text-ink-muted text-sm">this month</span>}
        >
          <RankBars
            rows={r.ai_jobs.map((j) => ({
              key: j.kind,
              label: jobLabels[j.kind] ?? j.kind,
              value: j.eur,
              sub: `${num(j.calls)} calls · ${num(j.tokens)} tokens`,
            }))}
            format={(n) => eur(n, true)}
            empty="No AI use this month"
          />
        </Card>
        <Card title="Menu imports">
          {r.uploads.length === 0 ? (
            <p className="text-ink-muted text-sm">No imports yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {r.uploads.map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span>
                    {{ photo: "Photos", pdf: "PDF", url: "Website" }[
                      u.source
                    ] ?? u.source}
                    <span className="text-ink-muted"> · {ago(u.at)}</span>
                  </span>
                  <Badge
                    className={
                      u.status === "failed"
                        ? "bg-paprika-100 text-paprika-800"
                        : u.status === "processing"
                          ? "bg-mustard-100 text-mustard-800"
                          : "bg-herb-100 text-herb-800"
                    }
                  >
                    {u.status === "failed"
                      ? `Failed: ${u.error ?? "unknown"}`
                      : u.status === "processing"
                        ? "Reading…"
                        : "Read"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * The restaurant's plan: what the owner says about seats, what that points to, how the last two
 * 30-day periods compare with the plan's visit limit, and the founder's control to change it
 * (hq_set_plan; owners can't change their own plan).
 */
function PlanCard({
  r,
  onSaved,
}: {
  r: RestaurantDetail;
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState<Plan>(r.plan);
  const [size, setSize] = useState<PlanSize>(r.plan_size);
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const changed = plan !== r.plan || size !== r.plan_size;
  const suggested = r.seats ? sizeForSeats(r.seats) : null;

  const save = async () => {
    setState("saving");
    const { data, error } = await supabase.rpc("hq_set_plan", {
      p_id: r.id,
      p_plan: plan,
      p_size: size,
    });
    if (error || data !== true) return setState("failed");
    setState("idle");
    onSaved();
  };

  const period = (label: string, visits: number) => (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span
        className={`font-semibold tabular-nums ${
          r.visit_limit !== null && visits > r.visit_limit ? "text-danger" : ""
        }`}
      >
        {num(visits)}
      </span>
    </li>
  );

  return (
    <Card
      title="Plan"
      action={
        r.above_plan ? (
          <Badge className="bg-paprika-100 text-paprika-800">
            Above plan 2 months: suggest{" "}
            {r.plan_size === "small" ? "Medium" : "Large"}
          </Badge>
        ) : undefined
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-ink-muted">Seats (from the owner): </span>
            <span className="font-semibold">{r.seats ?? "not filled in"}</span>
            {suggested && (
              <span className="text-ink-muted">
                {" "}
                · points to {sizeLabels[suggested]}
                {suggested !== r.plan_size && (
                  <span className="text-danger font-semibold"> (differs)</span>
                )}
              </span>
            )}
          </p>
          <div>
            <p className="text-ink-muted">
              Menu visits
              {r.visit_limit !== null
                ? ` (plan expects up to ${num(r.visit_limit)} a month)`
                : " (no limit on Large)"}
            </p>
            <ul className="mt-1 space-y-1">
              {period("Last 30 days", r.visits_30d)}
              {period("30 days before", r.visits_prev_30d)}
            </ul>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-ink-muted">Size</span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as PlanSize)}
              className="input mt-1 py-2.5"
            >
              {(Object.keys(sizePrices) as PlanSize[]).map((k) => (
                <option key={k} value={k}>
                  {sizeLabels[k]} · €{sizePrices[k]}/month or €
                  {sizePrices[k] * 10}/year
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">Billing</span>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className="input mt-1 py-2.5"
            >
              {(Object.keys(planLabels) as Plan[]).map((k) => (
                <option key={k} value={k}>
                  {planLabels[k]}
                </option>
              ))}
            </select>
          </label>
          {changed && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={state === "saving"}
              className="btn-primary w-full"
            >
              Save plan
            </button>
          )}
          {state === "failed" && (
            <p role="alert" className="text-danger text-sm">
              Couldn't save the plan. Try again.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
