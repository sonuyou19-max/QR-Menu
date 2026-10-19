import { useEffect, useRef, useState } from "react";
import {
  CircleCheck,
  Globe,
  Languages,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { fill, useI18n } from "../i18n";
import { languageName } from "../lib/languages";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

const POLL_MS = 3000;
/** Same as the edge function: a run still "running" after this long has died. */
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * "Publish menu" (first time) and "Translate now" (after edits). The publish-menu edge function
 * translates in the background; this card polls the restaurant until it is done.
 */
export function PublishCard({
  untranslated,
  onTranslated,
}: {
  /** Visible dishes + categories without an up-to-date translation in every guest language. */
  untranslated: number;
  onTranslated: () => void;
}) {
  const { t, lang } = useI18n();
  const { restaurant, reload } = useRestaurant();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<"generic" | "rateLimited" | null>(null);
  const p = t.editor.publish;

  const languages = restaurant.guest_languages
    .filter((l) => l !== restaurant.source_language)
    .map((l) => languageName(l, lang))
    .join(", ");
  const started = restaurant.translation_started_at
    ? new Date(restaurant.translation_started_at).getTime()
    : 0;
  const running =
    restaurant.translation_status === "running" &&
    Date.now() - started < STALE_AFTER_MS;

  // While translating, check every few seconds; when it ends, load the new translations.
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) onTranslated();
    wasRunning.current = running;
    if (!running) return;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, reload, onTranslated]);

  const start = async () => {
    setStarting(true);
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke(
      "publish-menu",
      {
        body: { restaurantId: restaurant.id },
      },
    );
    if (invokeError) {
      const status = (invokeError as { context?: Response }).context?.status;
      setError(status === 429 ? "rateLimited" : "generic");
    }
    await reload();
    setStarting(false);
  };

  const busy = starting || running;
  // A run that ended with errors leaves dishes untranslated, which the card already shows; the
  // message only matters when that isn't shown (nothing left, or the first publish failed).
  const failed =
    error !== null ||
    (restaurant.translation_status === "failed" &&
      (untranslated === 0 || !restaurant.is_published));
  const tone = busy
    ? "bg-surface"
    : !restaurant.is_published
      ? "bg-paprika-50"
      : untranslated > 0 || failed
        ? "bg-mustard-50"
        : "bg-herb-50";

  return (
    <section
      aria-labelledby="publish-title"
      aria-live="polite"
      className={`rounded-card mt-5 p-4 ${tone}`}
    >
      {busy ? (
        <div className="flex gap-3">
          <LoaderCircle
            className="text-brand mt-0.5 size-6 shrink-0 animate-spin"
            aria-hidden="true"
          />
          <div>
            <h2
              id="publish-title"
              className="font-sans text-base font-semibold"
            >
              {fill(p.running, { languages })}
            </h2>
            <p className="text-ink-muted text-sm">{p.runningHint}</p>
          </div>
        </div>
      ) : !restaurant.is_published ? (
        <div>
          <h2
            id="publish-title"
            className="flex items-center gap-2 font-sans text-base font-semibold"
          >
            <Globe className="size-5 shrink-0" aria-hidden="true" />
            {p.notPublishedTitle}
          </h2>
          <p className="text-ink-muted mt-1 text-sm">
            {fill(p.notPublishedText, { languages })}
          </p>
          <button
            type="button"
            onClick={() => void start()}
            className="btn-primary mt-3 w-full sm:w-auto"
          >
            <Globe className="size-5" aria-hidden="true" />
            {p.publish}
          </button>
        </div>
      ) : untranslated > 0 ? (
        <div>
          <h2
            id="publish-title"
            className="text-mustard-900 flex items-center gap-2 font-sans text-base font-semibold"
          >
            <Languages className="size-5 shrink-0" aria-hidden="true" />
            {untranslated === 1
              ? p.missingOne
              : fill(p.missing, { count: untranslated })}
          </h2>
          <p className="text-ink-muted mt-1 text-sm">{p.missingHint}</p>
          <button
            type="button"
            onClick={() => void start()}
            className="btn-primary mt-3 w-full sm:w-auto"
          >
            <Languages className="size-5" aria-hidden="true" />
            {p.translateNow}
          </button>
        </div>
      ) : (
        <h2
          id="publish-title"
          className="text-herb-800 flex items-center gap-2 font-sans text-base font-semibold"
        >
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
          {fill(p.online, { languages })}
        </h2>
      )}
      {failed && !busy && (
        <p
          role="alert"
          className="text-danger mt-2 flex gap-2 text-sm font-medium"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          {error === "rateLimited" ? p.rateLimited : p.error}
        </p>
      )}
    </section>
  );
}
