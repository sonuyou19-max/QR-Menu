import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { FullPageSpinner } from "../components/FullPageSpinner";
import { fill, useI18n } from "../i18n";
import type { Tables } from "../lib/database.types";
import {
  STALE_AFTER_MS,
  type ExtractedItem,
  type MenuExtraction,
  type UploadError,
} from "../lib/extraction";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

type Upload = Tables<"menu_uploads">;
const POLL_MS = 3000;

function isStale(upload: Upload): boolean {
  const started = upload.processing_started_at ?? upload.created_at;
  return (
    upload.status === "processing" &&
    Date.now() - new Date(started).getTime() > STALE_AFTER_MS
  );
}

export function UploadStatusBadge({ upload }: { upload: Upload }) {
  const { t } = useI18n();
  const status = isStale(upload)
    ? "failed"
    : (upload.status as keyof typeof t.upload.status);
  const tone =
    status === "needs_review" || status === "done"
      ? "bg-herb-100 text-herb-800"
      : status === "failed"
        ? "bg-paprika-100 text-paprika-800"
        : "bg-mustard-100 text-mustard-900";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {t.upload.status[status] ?? status}
    </span>
  );
}

/** Waits for process-menu, then shows what the AI read (review + editing come in step 5). */
export function UploadResult() {
  const showAllergens = useRestaurant().restaurant.show_allergens;
  const { id } = useParams();
  const { t, lang } = useI18n();
  const [upload, setUpload] = useState<Upload | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("menu_uploads")
      .select("*")
      .eq("id", id!)
      .maybeSingle();
    if (error) return setLoadFailed(true);
    setLoadFailed(false);
    setUpload(data);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const processing =
    upload?.status === "processing" && !isStale(upload) && !loadFailed;
  useEffect(() => {
    if (!processing) return;
    const poll = setInterval(() => void load(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [processing, load]);

  const retry = async () => {
    setRetrying(true);
    await supabase.functions.invoke("process-menu", {
      body: { uploadId: id, lang },
    });
    await load();
    setRetrying(false);
  };

  if (loadFailed && upload === undefined)
    return <FullPageSpinner error onRetry={() => void load()} />;
  if (upload === undefined) return <FullPageSpinner />;

  const back = (
    <Link
      to="/upload"
      className="text-ink-muted inline-flex min-h-11 items-center gap-1.5 font-medium"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t.result.back}
    </Link>
  );

  if (upload === null)
    return (
      <div>
        {back}
        <p className="mt-6 text-lg">{t.result.notFound}</p>
      </div>
    );

  if (processing) {
    const started = new Date(
      upload.processing_started_at ?? upload.created_at,
    ).getTime();
    const seconds = Math.max(0, Math.round((now - started) / 1000));
    return (
      <div>
        {back}
        <div className="rounded-card bg-surface shadow-card mt-6 flex flex-col items-center p-8 text-center">
          <LoaderCircle
            className="text-brand size-12 animate-spin"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-2xl font-semibold" aria-live="polite">
            {t.result.readingTitle}
          </h1>
          <p className="text-ink-muted mt-2 max-w-md">{t.result.readingText}</p>
          <p className="text-ink-muted mt-4 font-medium tabular-nums">
            {fill(t.result.elapsed, { seconds })}
          </p>
        </div>
      </div>
    );
  }

  if (upload.status === "failed" || isStale(upload)) {
    const code: UploadError | "stale" = isStale(upload)
      ? "stale"
      : ((upload.error as UploadError | null) ?? "server");
    return (
      <div>
        {back}
        <div className="rounded-card bg-surface shadow-card mt-6 p-6">
          <h1 className="flex items-start gap-2 text-2xl font-semibold">
            <TriangleAlert
              className="text-danger mt-1 size-6 shrink-0"
              aria-hidden="true"
            />
            {t.result.failedTitle}
          </h1>
          <p className="mt-2 text-lg">
            {t.result.errors[code] ?? t.result.errors.server}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {![
              "not_a_menu",
              "bad_url",
              "social_site",
              "no_menu_found",
              "pdf_locked",
            ].includes(code) && (
              <button
                type="button"
                disabled={retrying}
                onClick={() => void retry()}
                className="btn-primary"
              >
                {retrying ? (
                  <LoaderCircle
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <RotateCcw className="size-5" aria-hidden="true" />
                )}
                {t.result.retry}
              </button>
            )}
            <Link to="/upload" className="btn-secondary">
              {t.result.back}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const menu = upload.raw_result as unknown as MenuExtraction;
  const dishes = menu.categories.reduce((n, c) => n + c.items.length, 0);
  const missingPrices = menu.categories.reduce(
    (n, c) => n + c.items.filter((i) => i.price === null).length,
    0,
  );
  const money = new Intl.NumberFormat(lang, {
    style: "currency",
    currency: menu.currency || "EUR",
  });

  return (
    <div>
      {back}
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
        {fill(t.result.doneTitle, {
          dishes,
          categories: menu.categories.length,
        })}
      </h1>
      <p className="text-ink-muted mt-2 text-lg">{t.resultExtra.doneText}</p>
      {showAllergens && (
        <p className="text-ink-muted mt-2 text-sm">
          <span aria-hidden="true">⚠︎ </span>
          {t.result.suggestedAllergens}
        </p>
      )}

      {(menu.unreadable_sections.length > 0 || missingPrices > 0) && (
        <div className="rounded-card bg-mustard-50 mt-6 space-y-2 p-4">
          {missingPrices > 0 && (
            <p className="flex gap-2 font-semibold">
              <CircleAlert
                className="text-mustard-800 mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              {missingPrices === 1
                ? t.result.missingPriceOne
                : fill(t.result.missingPrices, { count: missingPrices })}
            </p>
          )}
          {menu.unreadable_sections.length > 0 && (
            <div>
              <p className="flex gap-2 font-semibold">
                <CircleAlert
                  className="text-mustard-800 mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                {t.result.notesTitle}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-12">
                {menu.unreadable_sections.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 space-y-8">
        {menu.categories.map((category, ci) => (
          <section key={`${ci}-${category.name}`}>
            <h2 className="border-line border-b pb-2 text-2xl font-semibold">
              {category.name}
            </h2>
            <ul className="divide-line divide-y">
              {category.items.map((item, ii) => (
                <DishRow
                  key={`${ii}-${item.name}`}
                  item={item}
                  money={money}
                  showAllergens={showAllergens}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <UseMenu upload={upload} onDone={load} />
    </div>
  );
}

/**
 * "Use this menu": copies the AI reading into the real menu (dishes, categories) for editing.
 * When the restaurant already has dishes, the owner chooses to replace them or add at the end.
 */
function UseMenu({
  upload,
  onDone,
}: {
  upload: Upload;
  onDone: () => Promise<void>;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (upload.status === "done")
    return (
      <div className="rounded-card bg-herb-50 text-herb-800 sticky bottom-4 mt-10 flex flex-wrap items-center gap-3 p-4 shadow-lg">
        <CircleCheck className="size-6 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 font-medium">{t.resultExtra.used}</p>
        <Link to="/menu" className="btn-primary">
          {t.nav.menu}
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </div>
    );

  const importAs = async (mode: "replace" | "append") => {
    setBusy(true);
    setFailed(false);
    const { error } = await supabase.rpc("import_menu_upload", {
      p_upload_id: upload.id,
      p_mode: mode,
    });
    setBusy(false);
    if (error) return setFailed(true);
    await onDone();
    navigate("/menu");
  };

  const start = async () => {
    setBusy(true);
    const { count, error } = await supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", upload.restaurant_id);
    setBusy(false);
    if (error) return setFailed(true);
    if ((count ?? 0) > 0) setChoosing(true);
    else await importAs("replace");
  };

  return (
    <div className="bg-canvas/95 border-line sticky bottom-0 -mx-4 mt-10 border-t px-4 py-3 backdrop-blur">
      {failed && (
        <p role="alert" className="text-danger mb-2 text-sm font-medium">
          {t.resultExtra.importError}
        </p>
      )}
      {choosing ? (
        <div role="group" aria-labelledby="import-choice">
          <p id="import-choice" className="font-semibold">
            {t.resultExtra.importTitle}
          </p>
          <p className="text-ink-muted text-sm">{t.resultExtra.importText}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void importAs("replace")}
              className="btn-primary"
            >
              {t.resultExtra.replace}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void importAs("append")}
              className="btn-secondary"
            >
              {t.resultExtra.append}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="btn-primary w-full text-lg"
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-5" aria-hidden="true" />
          )}
          {busy ? t.resultExtra.importing : t.resultExtra.useMenu}
        </button>
      )}
    </div>
  );
}

/** "€4,50 / €18" (glass/bottle, sizes): show the printed text under the first price. */
function hasSeveralPrices(text: string | null): boolean {
  return (text?.match(/\d+(?:[.,]\d+)?/g)?.length ?? 0) > 1;
}

function DishRow({
  item,
  money,
  showAllergens,
}: {
  item: ExtractedItem;
  money: Intl.NumberFormat;
  showAllergens: boolean;
}) {
  const { t } = useI18n();
  const tags = (
    Object.keys(item.dietary) as (keyof ExtractedItem["dietary"])[]
  ).filter((key) => item.dietary[key]);
  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-lg font-semibold">{item.name}</p>
        {item.price === null ? (
          <span className="bg-paprika-50 text-danger shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold">
            {t.result.priceMissing}
          </span>
        ) : (
          <span className="shrink-0 text-lg font-semibold tabular-nums">
            {money.format(item.price)}
          </span>
        )}
      </div>
      {item.price !== null && hasSeveralPrices(item.price_text) && (
        <p className="text-ink-muted text-sm">{item.price_text}</p>
      )}
      {item.menu_description && <p className="mt-1">{item.menu_description}</p>}
      {!item.menu_description && item.typical_description && (
        <p className="text-ink-muted mt-1 italic">
          <Info
            className="mr-1 inline size-4 align-[-2px] not-italic"
            aria-label={t.result.typical}
          />
          {item.typical_description}
        </p>
      )}
      {item.confidence === "unknown" && !item.menu_description && (
        <p className="text-mustard-800 mt-1 text-sm font-medium">
          {t.result.unknownDish}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
        {tags.map((tag) => (
          <span
            key={tag}
            className="bg-herb-50 text-herb-800 rounded-full px-2.5 py-0.5"
          >
            {t.dietary[tag]}
          </span>
        ))}
        {showAllergens && item.suggested_allergens.length > 0 && (
          <span className="text-ink-muted">
            <span className="sr-only">{t.result.suggestedAllergens}: </span>
            <span aria-hidden="true">⚠︎ </span>
            {item.suggested_allergens.map((a) => t.allergens[a]).join(", ")}
          </span>
        )}
      </div>
    </li>
  );
}
