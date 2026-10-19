// "Try with your own menu" (CLAUDE.md 4.6 Demo B): a restaurant owner photographs their menu,
// picks a language and sees it translated in a phone frame. Calls the demo-translate edge
// function (honeypot + Turnstile + limits there); the result is a preview, never published.
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  Camera,
  ImagePlus,
  Info,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Dictionary, Lang } from "../../i18n";
import { compressPhoto } from "./compress-photo";
import { loadTurnstile } from "./turnstile";

type Copy = Dictionary["tryMenu"];
type ErrorKey = keyof Copy["errors"];

const MAX_PHOTOS = 3;
const POLL_MS = 3000;
const languages = [
  "en",
  "fr",
  "nl",
  "de",
  "es",
  "it",
  "pt",
  "pl",
  "zh",
  "ja",
  "ko",
  "ar",
] as const;

interface Dish {
  name: string;
  translated_name: string | null;
  price: number | null;
  price_text: string | null;
  description: string | null;
  description_is_typical: boolean;
}
interface Preview {
  restaurant_name: string | null;
  source_language: string;
  target_language: string;
  currency: string;
  categories: { name: string; translated_name: string | null; items: Dish[] }[];
}
interface Photo {
  id: string;
  base64: string;
}
type State =
  | { step: "form" }
  | { step: "preparing" }
  | { step: "sending" }
  | { step: "reading"; runId: string; token: string; started: number }
  | { step: "done"; preview: Preview };

export interface TryYourMenuProps {
  lang: Lang;
  t: Copy;
  endpoint: string;
  siteKey: string;
  /** Book-a-demo page; the restaurant name Buddy read is passed along. */
  demoHref: string;
  /** Phone preview (claude.ai page): no network there, so the form only shows itself. */
  previewMode?: boolean;
}

const RUN_KEY = "mb.tryMenuRun";
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

function languageName(code: string, inLanguage: string) {
  try {
    const name =
      new Intl.DisplayNames([inLanguage], { type: "language" }).of(code) ??
      code;
    return name.charAt(0).toLocaleUpperCase(inLanguage) + name.slice(1);
  } catch {
    return code;
  }
}

export default function TryYourMenu({
  lang,
  t,
  endpoint,
  siteKey,
  demoHref,
  previewMode = false,
}: TryYourMenuProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [language, setLanguage] = useState<string>(lang === "en" ? "fr" : "en");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>({ step: "form" });
  const [error, setError] = useState<ErrorKey | null>(null);
  const [token, setToken] = useState("");
  const [now, setNow] = useState(Date.now());
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);

  // Spam check, loaded with the form.
  useEffect(() => {
    if (previewMode) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !widgetRef.current || widgetId.current) return;
        widgetId.current = turnstile.render(widgetRef.current, {
          sitekey: siteKey,
          language: lang,
          appearance: "interaction-only",
          callback: (value: string) => setToken(value),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lang, siteKey, previewMode]);

  // A reload while Buddy is reading picks the same run up again.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(RUN_KEY) ?? "null") as {
        runId: string;
        token: string;
        started: number;
      } | null;
      if (saved && Date.now() - saved.started < 5 * 60 * 1000)
        setState({ step: "reading", ...saved });
    } catch {
      // No saved run.
    }
  }, []);

  const reading = state.step === "reading" ? state : null;
  useEffect(() => {
    if (!reading) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "status",
            runId: reading.runId,
            token: reading.token,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          status?: string;
          error?: ErrorKey | null;
          result?: Preview | null;
        };
        if (stopped) return;
        if (data.ok && data.status === "processing") return;
        sessionStorage.removeItem(RUN_KEY);
        if (data.ok && data.status === "done" && data.result) {
          setState({ step: "done", preview: data.result });
          requestAnimationFrame(() =>
            phoneRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          );
        } else
          fail(data.error && data.error in t.errors ? data.error : "server");
      } catch {
        // Try again on the next tick (a phone briefly offline).
      }
    };
    const timer = setInterval(() => void poll(), POLL_MS);
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading?.runId]);

  const fail = (key: ErrorKey) => {
    setState({ step: "form" });
    setError(key);
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    setState({ step: "preparing" });
    const added: Photo[] = [];
    let failed = false;
    for (const file of Array.from(files).slice(0, room)) {
      try {
        added.push({
          id: crypto.randomUUID(),
          base64: await compressPhoto(file),
        });
      } catch {
        failed = true;
      }
    }
    setPhotos((list) => [...list, ...added]);
    setState({ step: "form" });
    if (failed) fail("photo");
  };

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (photos.length === 0) return fail("noPhoto");
    if (previewMode) return;
    if (!token) return fail("captchaPending");
    setState({ step: "sending" });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          photos: photos.map((p) => p.base64),
          language,
          website,
          turnstileToken: token,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        runId?: string;
        token?: string;
        error?: string;
      };
      if (!data.ok || !data.runId || !data.token)
        return fail(
          data.error && data.error in t.errors
            ? (data.error as ErrorKey)
            : "server",
        );
      const run = { runId: data.runId, token: data.token, started: Date.now() };
      try {
        sessionStorage.setItem(RUN_KEY, JSON.stringify(run));
      } catch {
        // Not kept after a reload; the preview still works.
      }
      setState({ step: "reading", ...run });
    } catch {
      fail("server");
    } finally {
      // A Turnstile token is single-use: get a fresh one for the next attempt.
      setToken("");
      if (window.turnstile && widgetId.current)
        window.turnstile.reset(widgetId.current);
    }
  };

  const again = () => {
    setPhotos([]);
    setState({ step: "form" });
  };

  const busy = state.step !== "form" && state.step !== "done";
  const done = state.step === "done" ? state.preview : null;

  return (
    <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-6">
        {error && (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-control bg-paprika-50 text-danger flex gap-2 p-3 font-medium"
          >
            <TriangleAlert
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            {t.errors[error]}
          </p>
        )}

        <fieldset disabled={busy || !!done}>
          <legend className="font-semibold">{t.photosLabel}</legend>
          <p className="text-ink-muted text-sm">
            {fill(t.maxPhotos, { max: MAX_PHOTOS })}
          </p>
          {photos.length > 0 && (
            <ol className="mt-3 grid grid-cols-3 gap-3">
              {photos.map((photo, i) => (
                <li
                  key={photo.id}
                  className="bg-surface shadow-card relative overflow-hidden rounded-xl"
                >
                  <img
                    src={`data:image/jpeg;base64,${photo.base64}`}
                    alt={fill(t.page, { n: i + 1 })}
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <span className="bg-ink/80 text-canvas absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-xs font-semibold">
                    {i + 1}
                  </span>
                  {!done && (
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((list) =>
                          list.filter((p) => p.id !== photo.id),
                        )
                      }
                      className="bg-surface/90 text-ink absolute top-1 right-1 grid size-9 place-items-center rounded-full"
                      aria-label={fill(t.remove, { n: i + 1 })}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
          {photos.length < MAX_PHOTOS && !done && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => cameraInput.current?.click()}
                className={
                  photos.length ? "btn btn-secondary" : "btn btn-primary"
                }
              >
                <Camera className="size-5" aria-hidden="true" />
                {photos.length ? t.addMore : t.takePhoto}
              </button>
              <button
                type="button"
                onClick={() => galleryInput.current?.click()}
                className="btn btn-secondary"
              >
                <ImagePlus className="size-5" aria-hidden="true" />
                {t.choosePhotos}
              </button>
            </div>
          )}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </fieldset>

        <label className="block">
          <span className="font-semibold">{t.languageLabel}</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={busy || !!done}
            className="rounded-control border-line bg-surface text-ink mt-1.5 w-full border px-3.5 py-3 text-base"
          >
            {languages.map((code) => (
              <option key={code} value={code}>
                {languageName(code, lang)}
              </option>
            ))}
          </select>
        </label>

        {/* Honeypot: hidden from people, bots fill it in. */}
        <label className="sr-only" aria-hidden="true">
          {t.honeypot}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
        <div ref={widgetRef} />

        {done ? (
          <button
            type="button"
            onClick={again}
            className="btn btn-secondary w-full"
          >
            <RotateCcw className="size-5" aria-hidden="true" />
            {t.again}
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full text-lg"
          >
            {busy ? (
              <LoaderCircle
                className="size-5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Sparkles className="size-5" aria-hidden="true" />
            )}
            {state.step === "preparing"
              ? t.preparing
              : state.step === "sending"
                ? t.sending
                : state.step === "reading"
                  ? t.reading
                  : t.submit}
          </button>
        )}
        <p className="text-ink-muted flex gap-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t.privacy}
        </p>
      </form>

      <div ref={phoneRef} className="mx-auto w-full max-w-[22rem] scroll-mt-6">
        <div className="rounded-phone border-oat-900 bg-oat-900 shadow-phone relative aspect-[9/19] w-full overflow-hidden border-[10px]">
          <div className="bg-oat-900 absolute top-1.5 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full" />
          <div className="bg-canvas absolute inset-0 overflow-hidden rounded-[2rem]">
            {done ? (
              <PreviewMenu preview={done} t={t} lang={lang} />
            ) : (
              <div
                className="grid h-full place-items-center p-8 text-center"
                aria-live="polite"
              >
                {reading ? (
                  <div>
                    <LoaderCircle
                      className="text-brand mx-auto size-10 animate-spin"
                      aria-hidden="true"
                    />
                    <p className="font-display mt-4 text-xl font-semibold">
                      {t.reading}
                    </p>
                    <p className="text-ink-muted mt-2 text-sm">
                      {t.readingHint}
                    </p>
                    <p className="text-ink-muted mt-3 text-sm font-medium tabular-nums">
                      {fill(t.elapsed, {
                        seconds: Math.max(
                          0,
                          Math.round((now - reading.started) / 1000),
                        ),
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="text-ink-muted">{t.phonePlaceholder}</p>
                )}
              </div>
            )}
          </div>
        </div>
        {done && (
          <div className="rounded-card bg-surface shadow-card mt-6 p-5 text-center">
            <p className="font-display text-xl font-semibold">{t.ctaTitle}</p>
            <p className="text-ink-muted mt-1">{t.ctaText}</p>
            <a
              href={
                done.restaurant_name
                  ? `${demoHref}?restaurant=${encodeURIComponent(done.restaurant_name)}`
                  : demoHref
              }
              data-cta="try-menu-book-demo"
              className="btn btn-primary mt-4 w-full"
            >
              {t.ctaButton}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** The preview inside the phone, styled like the real guest menu. */
function PreviewMenu({
  preview,
  t,
  lang,
}: {
  preview: Preview;
  t: Copy;
  lang: Lang;
}) {
  const money = (() => {
    try {
      return new Intl.NumberFormat(preview.target_language, {
        style: "currency",
        currency: preview.currency,
      });
    } catch {
      return new Intl.NumberFormat(lang, {
        style: "currency",
        currency: "EUR",
      });
    }
  })();
  const rtl = preview.target_language === "ar";
  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-brand text-on-brand px-5 pt-9 pb-4">
        <p className="font-display text-2xl leading-tight font-semibold">
          {preview.restaurant_name ?? t.yourMenu}
        </p>
        <p className="mt-2 inline-flex rounded-full bg-black/20 px-2.5 py-1 text-xs font-semibold">
          {t.previewBadge}
        </p>
      </div>
      <div className="space-y-6 px-5 py-5" dir={rtl ? "rtl" : "ltr"}>
        {preview.categories.map((category, c) => (
          <section key={c}>
            <h3
              className="font-display text-xl leading-tight font-semibold"
              dir="auto"
            >
              {category.translated_name ?? category.name}
            </h3>
            {category.translated_name &&
              category.translated_name !== category.name && (
                <p className="text-ink-muted text-sm" dir="auto">
                  {category.name}
                </p>
              )}
            <ul className="divide-line mt-2 divide-y">
              {category.items.map((dish, i) => (
                <li key={i} className="py-3">
                  <p className="leading-snug font-semibold" dir="auto">
                    {dish.name}
                  </p>
                  {dish.translated_name &&
                    dish.translated_name !== dish.name && (
                      <p className="text-ink-muted text-sm" dir="auto">
                        {dish.translated_name}
                      </p>
                    )}
                  {(dish.price !== null || dish.price_text) && (
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {dish.price !== null
                        ? money.format(dish.price)
                        : dish.price_text}
                    </p>
                  )}
                  {dish.description && (
                    <p
                      className={`text-ink-muted mt-1 text-sm ${dish.description_is_typical ? "italic" : ""}`}
                      dir="auto"
                    >
                      {dish.description_is_typical && (
                        <span className="not-italic" title={t.typical}>
                          ⓘ{" "}
                        </span>
                      )}
                      {dish.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
