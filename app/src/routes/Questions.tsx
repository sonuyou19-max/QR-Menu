// "Guest questions" (CLAUDE.md 4.1 Monitoring): what guests asked Brisolo and what it answered,
// newest first. The owner marks a wrong answer; flagged answers go into the test set
// (menu-chat/evals.json) before prompts or models change. Owners may only change flagged_by_owner.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Flag } from "lucide-react";
import { useI18n } from "../i18n";
import { languageName } from "../lib/languages";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

const PAGE = 30;

interface Row {
  id: number;
  created_at: string;
  language: string;
  question: string;
  answer: string;
  answer_type: string;
  flagged_by_owner: boolean;
}

export function Questions() {
  const { t, lang } = useI18n();
  const { restaurant } = useRestaurant();
  const T = t.questions;
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      let query = supabase
        .from("chat_logs")
        .select(
          "id, created_at, language, question, answer, answer_type, flagged_by_owner",
        )
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE);
      if (onlyFlagged) query = query.eq("flagged_by_owner", true);
      const { data, error } = await query;
      if (error) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setMore(data.length > PAGE);
      const page = data.slice(0, PAGE);
      setRows((old) => (offset === 0 ? page : [...(old ?? []), ...page]));
    },
    [restaurant.id, onlyFlagged],
  );
  useEffect(() => {
    setRows(null);
    void load(0);
  }, [load]);

  const toggle = async (row: Row) => {
    const flagged = !row.flagged_by_owner;
    const set = (value: boolean) =>
      setRows((old) =>
        (old ?? []).map((r) =>
          r.id === row.id ? { ...r, flagged_by_owner: value } : r,
        ),
      );
    set(flagged);
    const { error } = await supabase
      .from("chat_logs")
      .update({ flagged_by_owner: flagged })
      .eq("id", row.id);
    if (error) set(!flagged);
  };

  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div>
      <Link
        to="/"
        className="text-ink-muted inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {T.back}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{T.title}</h1>
      <p className="text-ink-muted mt-2">{T.intro}</p>

      <div
        role="radiogroup"
        aria-label={T.show}
        className="rounded-control bg-surface-muted mt-5 inline-flex gap-1 p-1"
      >
        {[false, true].map((flagged) => (
          <button
            key={String(flagged)}
            type="button"
            role="radio"
            aria-checked={onlyFlagged === flagged}
            onClick={() => setOnlyFlagged(flagged)}
            className={`rounded-control min-h-10 px-3 text-sm font-semibold ${
              onlyFlagged === flagged
                ? "bg-surface shadow-card"
                : "text-ink-muted"
            }`}
          >
            {flagged ? T.flaggedOnly : T.all}
          </button>
        ))}
      </div>

      {failed ? (
        <p className="text-danger mt-6">{T.loadFailed}</p>
      ) : rows === null ? (
        <div className="bg-surface-muted rounded-card mt-6 h-40 animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="text-ink-muted mt-6">
          {onlyFlagged ? T.noneFlagged : T.none}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`rounded-card bg-surface shadow-card p-4 ${
                row.flagged_by_owner ? "ring-danger ring-2" : ""
              }`}
            >
              <p className="text-ink-muted text-xs">
                {when(row.created_at)} · {languageName(row.language, lang)}
                {T.types[row.answer_type as keyof typeof T.types] &&
                  ` · ${T.types[row.answer_type as keyof typeof T.types]}`}
              </p>
              <p className="mt-2 font-semibold" dir="auto">
                {row.question}
              </p>
              <p className="text-ink-muted mt-1 whitespace-pre-line" dir="auto">
                {row.answer}
              </p>
              <button
                type="button"
                onClick={() => void toggle(row)}
                aria-pressed={row.flagged_by_owner}
                className={`rounded-control mt-3 inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold ${
                  row.flagged_by_owner
                    ? "bg-paprika-100 text-paprika-800"
                    : "bg-surface-muted text-ink"
                }`}
              >
                <Flag className="size-4" aria-hidden="true" />
                {row.flagged_by_owner ? T.flagged : T.flag}
              </button>
            </li>
          ))}
        </ul>
      )}
      {more && rows && (
        <button
          type="button"
          onClick={() => void load(rows.length)}
          className="rounded-control border-line mt-4 min-h-11 w-full border font-semibold"
        >
          {T.showMore}
        </button>
      )}
    </div>
  );
}
