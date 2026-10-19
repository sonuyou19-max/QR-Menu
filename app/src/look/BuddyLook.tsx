import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Check, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useI18n } from "../i18n";
import { supabase } from "../lib/supabase";
import { fontPairs, readTheme, themeStyle, type Theme } from "../lib/theme";

type Suggestion = Omit<Theme, "tagline" | "cover_path"> & {
  tagline: string;
  vibe: string;
};

/**
 * "Ask Buddy for a look" (suggest-theme): Buddy looks at the logo, cover photo, menu and website
 * and proposes a complete look. Nothing changes until the owner taps "Use this look".
 */
export function BuddyLook({
  restaurantId,
  name,
  current,
  onUse,
}: {
  restaurantId: string;
  name: string;
  current: Theme;
  onUse: (patch: Partial<Theme>) => void;
}) {
  const { t, lang } = useI18n();
  const B = t.look.buddy;
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"limit" | "failed" | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [earlier, setEarlier] = useState<Suggestion[]>([]);
  const [used, setUsed] = useState(false);

  const ask = async (another: boolean) => {
    setBusy(true);
    setError(null);
    setUsed(false);
    const avoid = (another && suggestion ? [...earlier, suggestion] : earlier)
      .slice(-5)
      .map((s) => ({ fonts: s.fonts, accent: s.accent, template: s.template }));
    const { data, error: fail } = await supabase.functions.invoke<{
      ok: boolean;
      suggestion: Suggestion;
    }>("suggest-theme", {
      body: {
        restaurantId,
        lang,
        website: website.trim() || undefined,
        avoid,
      },
    });
    setBusy(false);
    if (fail || !data?.ok) {
      const body =
        fail instanceof FunctionsHttpError
          ? ((await fail.context.json().catch(() => null)) as {
              error?: string;
            } | null)
          : null;
      return setError(body?.error === "rate_limited" ? "limit" : "failed");
    }
    if (another && suggestion) setEarlier((e) => [...e, suggestion]);
    setSuggestion(data.suggestion);
  };

  const preview = suggestion
    ? readTheme({ ...current, ...suggestion, tagline: suggestion.tagline })
    : null;

  return (
    <section className="rounded-card border-paprika-200 bg-paprika-50 mt-6 border-2 border-dashed p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Sparkles className="text-brand size-5" aria-hidden="true" />
        {B.title}
      </h2>
      <p className="text-ink-muted mt-1">{B.text}</p>

      <label className="mt-4 block">
        <span className="font-semibold">{B.website}</span>{" "}
        <span className="text-ink-muted text-sm">({B.optional})</span>
        <input
          type="url"
          inputMode="url"
          autoComplete="url"
          className="input mt-1"
          placeholder="https://"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>

      {!suggestion && (
        <button
          type="button"
          onClick={() => void ask(false)}
          disabled={busy}
          className="btn-primary mt-4 w-full sm:w-auto"
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-5" aria-hidden="true" />
          )}
          {busy ? B.asking : B.ask}
        </button>
      )}
      {error && (
        <p role="alert" className="text-danger mt-3 font-medium">
          {error === "limit" ? B.limit : B.failed}
        </p>
      )}

      {suggestion && preview && (
        <div className="mt-5" aria-live="polite">
          <p className="font-semibold">{B.suggests}</p>
          <p className="text-ink-muted mt-1 italic">“{suggestion.vibe}”</p>
          <div
            className="rounded-card border-line mt-3 overflow-hidden border"
            style={{ ...themeStyle(preview), color: "var(--color-ink)" }}
          >
            <div
              className="px-4 py-3"
              style={
                preview.header === "band"
                  ? {
                      background: "var(--color-brand)",
                      color: "var(--color-on-brand)",
                    }
                  : { textAlign: "center" }
              }
            >
              <p
                className="truncate text-2xl font-semibold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {name}
              </p>
              {preview.tagline && (
                <p className="text-sm opacity-80">{preview.tagline}</p>
              )}
            </div>
            <div
              className="flex items-start gap-3 px-4 pt-3 pb-4"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.look.fontSample}</p>
                <p className="text-sm font-semibold">€22,50</p>
                <p
                  className="text-sm"
                  style={{ color: "var(--color-ink-muted)" }}
                >
                  {B.sampleDescription}
                </p>
              </div>
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full border text-xl"
                style={{
                  color: "var(--color-brand-strong)",
                  borderColor: "var(--color-line)",
                  background: "var(--color-surface)",
                }}
                aria-hidden="true"
              >
                +
              </span>
            </div>
          </div>
          <p className="text-ink-muted mt-2 text-sm">
            {t.look.templates[preview.template]} ·{" "}
            {t.look.fontNames[preview.fonts]} ·{" "}
            {t.look.options.layout[preview.layout]} ·{" "}
            {t.look.options.texture[preview.texture]}
            <span className="sr-only">
              {" "}
              ({fontPairs[preview.fonts].heading})
            </span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const { vibe: _vibe, tagline, ...look } = suggestion;
                // The owner's own line always wins over Buddy's.
                onUse({ ...look, ...(current.tagline ? {} : { tagline }) });
                setUsed(true);
              }}
              className="btn-primary"
            >
              <Check className="size-5" aria-hidden="true" />
              {used ? B.used : B.use}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void ask(true)}
              className="btn-secondary"
            >
              {busy ? (
                <LoaderCircle
                  className="size-5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw className="size-5" aria-hidden="true" />
              )}
              {busy ? B.asking : B.again}
            </button>
          </div>
          {used && <p className="text-ink-muted mt-2 text-sm">{B.usedHint}</p>}
        </div>
      )}
    </section>
  );
}
