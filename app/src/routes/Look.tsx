import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Eye, ImagePlus, LoaderCircle, Undo2, X } from "lucide-react";
import { useI18n } from "../i18n";
import type { Json } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import {
  TAGLINE_MAX,
  brandingImage,
  cornerStyles,
  fontPairs,
  headers,
  headingStyles,
  layouts,
  loadFonts,
  mix,
  ornaments,
  presets,
  readTheme,
  templates,
  textureStyle,
  textures,
  themeStyle,
  type FontPair,
  type Theme,
} from "../lib/theme";
import { Ornament, type PreviewMessage } from "../guest/Look";
import { BuddyLook } from "../look/BuddyLook";
import { coloursFrom, removeBranding, uploadBranding } from "../look/branding";
import { useRestaurant } from "../restaurant/RestaurantProvider";

type Status = "idle" | "saving" | "saved" | "error";

/** Look screen (CLAUDE.md 4.4): the restaurant's own look for its guest menu, saved as you go. */
export function Look() {
  const { t } = useI18n();
  const L = t.look;
  const { restaurant, reload } = useRestaurant();
  const [theme, setTheme] = useState<Theme>(() => readTheme(restaurant.theme));
  const [logo, setLogo] = useState<string | null>(restaurant.logo_path);
  const [history, setHistory] = useState<Theme[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [imageColours, setImageColours] = useState<string[]>([]);
  const [busy, setBusy] = useState<"logo" | "cover" | null>(null);
  const [uploadError, setUploadError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // A restaurant that never chose a look shows no style as picked yet.
  const chosen =
    !!restaurant.theme &&
    typeof restaurant.theme === "object" &&
    Object.keys(restaurant.theme).length > 0;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastChange = useRef({ key: "", at: 0 });

  // Every font pair is shown in its own letters.
  useEffect(() => {
    for (const pair of Object.keys(fontPairs) as FontPair[])
      void loadFonts(pair);
  }, []);

  const save = useCallback(
    async (next: Theme) => {
      setStatus("saving");
      const { error } = await supabase
        .from("restaurants")
        .update({ theme: next as unknown as Json })
        .eq("id", restaurant.id);
      if (error) return setStatus("error");
      setStatus("saved");
      void reload();
    },
    [restaurant.id, reload],
  );

  const schedule = (next: Theme) => {
    clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(() => void save(next), 600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Apply a change; quick repeats of the same control (dragging a colour) are one undo step. */
  const change = (patch: Partial<Theme>) => {
    const key = Object.keys(patch).sort().join();
    const now = Date.now();
    if (key !== lastChange.current.key || now - lastChange.current.at > 1500)
      setHistory((h) => [...h.slice(-19), theme]);
    lastChange.current = { key, at: now };
    const next = { ...theme, ...patch };
    setTheme(next);
    schedule(next);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    lastChange.current = { key: "", at: 0 };
    setTheme(previous);
    schedule(previous);
  };

  // Colours that are really the restaurant's: read from its logo and cover photo.
  useEffect(() => {
    let current = true;
    void Promise.all(
      [logo, theme.cover_path].filter((p): p is string => !!p).map(coloursFrom),
    ).then((lists) => {
      if (!current) return;
      const all: string[] = [];
      for (const c of lists.flat()) if (!all.includes(c)) all.push(c);
      setImageColours(all.slice(0, 6));
    });
    return () => {
      current = false;
    };
  }, [logo, theme.cover_path]);

  const upload = async (kind: "logo" | "cover", file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    setUploadError(false);
    const path = await uploadBranding(restaurant.id, kind, file);
    setBusy(null);
    if (!path) return setUploadError(true);
    if (kind === "logo") await setLogoPath(path);
    // A new cover photo is shown at the top straight away.
    else change({ cover_path: path, header: "cover" });
  };

  const setLogoPath = async (path: string | null) => {
    const old = logo;
    setLogo(path);
    const { error } = await supabase
      .from("restaurants")
      .update({ logo_path: path })
      .eq("id", restaurant.id);
    if (error) {
      setLogo(old);
      return setStatus("error");
    }
    void removeBranding(old);
    void reload();
  };

  const accentChoices = [
    ...imageColours,
    ...Object.values(presets).map((p) => p.accent),
  ].filter((c, i, all) => all.indexOf(c) === i);
  const backgroundChoices = [
    "#ffffff",
    "#fbf7f1",
    mix(theme.accent, "#ffffff", 0.93),
    mix(theme.accent, "#ffffff", 0.85),
    ...imageColours.map((c) => mix(c, "#ffffff", 0.9)),
    mix(theme.accent, "#000000", 0.82),
    "#15120f",
  ].filter((c, i, all) => all.indexOf(c) === i);

  return (
    <div className="pb-28">
      <h1 className="text-3xl font-semibold sm:text-4xl">{L.title}</h1>
      <p className="text-ink-muted mt-2 text-lg">{L.intro}</p>

      <BuddyLook
        restaurantId={restaurant.id}
        name={restaurant.name}
        current={theme}
        onUse={change}
      />

      <Section title={L.start} hint={L.startHint}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {templates.map((tpl) => {
            const preset = { ...theme, ...presets[tpl] };
            const fonts = fontPairs[preset.fonts];
            const active = chosen && theme.template === tpl;
            return (
              <button
                key={tpl}
                type="button"
                aria-pressed={active}
                onClick={() => change(presets[tpl])}
                className={`rounded-card overflow-hidden border-2 text-start ${
                  active ? "border-brand" : "border-line"
                }`}
              >
                <span
                  className="block px-3 pt-3 pb-2"
                  style={{ ...themeStyle(preset), color: "var(--color-ink)" }}
                >
                  <span
                    className="block truncate text-xl font-semibold"
                    style={{ fontFamily: `"${fonts.heading}"` }}
                  >
                    {restaurant.name}
                  </span>
                  <span className="mt-1.5 flex items-center justify-between gap-2">
                    <span
                      className="truncate text-sm"
                      style={{ fontFamily: `"${fonts.body}"` }}
                    >
                      {L.fontSample}
                    </span>
                    <span
                      className="size-4 shrink-0 rounded-full"
                      style={{ background: preset.accent }}
                    />
                  </span>
                </span>
                <span className="bg-surface block px-3 py-2">
                  <span className="flex items-center gap-1 font-semibold">
                    {active && (
                      <Check className="text-brand size-4" aria-hidden="true" />
                    )}
                    {L.templates[tpl]}
                  </span>
                  <span className="text-ink-muted block text-sm">
                    {L.templateHints[tpl]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={L.photos}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageSlot
            label={L.logo}
            hint={L.logoHint}
            url={brandingImage(logo)}
            busy={busy === "logo"}
            contain
            L={L}
            onPick={(f) => void upload("logo", f)}
            onRemove={() => void setLogoPath(null)}
          />
          <ImageSlot
            label={L.cover}
            hint={L.coverHint}
            url={brandingImage(theme.cover_path)}
            busy={busy === "cover"}
            L={L}
            onPick={(f) => void upload("cover", f)}
            onRemove={() =>
              change({
                cover_path: null,
                header: theme.header === "cover" ? "centered" : theme.header,
              })
            }
          />
        </div>
        {uploadError && (
          <p role="alert" className="text-danger mt-2 font-medium">
            {L.uploadError}
          </p>
        )}
        {theme.cover_path && (
          <CoverPreview url={brandingImage(theme.cover_path)!} L={L} />
        )}
      </Section>

      <Section title={L.tagline} hint={L.taglineHint}>
        <input
          className="input"
          value={theme.tagline}
          maxLength={TAGLINE_MAX}
          placeholder={L.taglinePlaceholder}
          aria-label={L.tagline}
          onChange={(e) => change({ tagline: e.target.value })}
          dir="auto"
        />
      </Section>

      <Section title={L.colours} hint={L.readable}>
        <ColourRow
          label={L.accent}
          hint={L.accentHint}
          value={theme.accent}
          choices={accentChoices}
          highlight={imageColours}
          highlightLabel={L.fromImages}
          pickLabel={L.pickColour}
          onChange={(accent) => change({ accent })}
        />
        <ColourRow
          label={L.background}
          value={theme.background}
          choices={backgroundChoices}
          pickLabel={L.pickColour}
          onChange={(background) => change({ background })}
        />
      </Section>

      <Section title={L.fonts}>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(fontPairs) as FontPair[]).map((pair) => {
            const f = fontPairs[pair];
            const active = theme.fonts === pair;
            return (
              <button
                key={pair}
                type="button"
                aria-pressed={active}
                onClick={() => change({ fonts: pair })}
                className={`rounded-control bg-surface flex items-center gap-3 border-2 px-3 py-2.5 text-start ${
                  active ? "border-brand" : "border-line"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-xl font-semibold"
                    style={{ fontFamily: `"${f.heading}"` }}
                  >
                    {restaurant.name}
                  </span>
                  <span
                    className="text-ink-muted block truncate"
                    style={{ fontFamily: `"${f.body}"` }}
                  >
                    {L.fontSample} · €22,50
                  </span>
                </span>
                <span className="text-ink-muted shrink-0 text-xs font-semibold">
                  {L.fontNames[pair]}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={L.header}>
        <Choices
          value={theme.header}
          options={headers}
          labels={L.options.header}
          onChange={(header) => change({ header })}
        />
        {theme.header === "cover" && !theme.cover_path && (
          <p className="text-ink-muted mt-2 text-sm">{L.coverNeeded}</p>
        )}
      </Section>

      <Section title={L.layout}>
        <Choices
          value={theme.layout}
          options={layouts}
          labels={L.options.layout}
          onChange={(layout) => change({ layout })}
        />
      </Section>

      <Section title={L.headings}>
        <Choices
          value={theme.headings}
          options={headingStyles}
          labels={L.options.headings}
          onChange={(headings) => change({ headings })}
        />
      </Section>

      <Section title={L.ornament}>
        <Choices
          value={theme.ornament}
          options={ornaments}
          labels={L.options.ornament}
          onChange={(ornament) => change({ ornament })}
          preview={(ornament) =>
            ornament === "none" ? null : (
              <span style={themeStyle(theme)} className="block rounded-md py-2">
                <Ornament
                  theme={{ ...theme, ornament }}
                  name={restaurant.name}
                />
              </span>
            )
          }
        />
      </Section>

      <Section title={L.texture}>
        <Choices
          value={theme.texture}
          options={textures}
          labels={L.options.texture}
          onChange={(texture) => change({ texture })}
          preview={(texture) => (
            <span
              className="border-line block h-12 rounded-md border"
              style={{
                background: theme.background,
                ...textureStyle({ ...theme, texture }),
              }}
            />
          )}
        />
      </Section>

      <Section title={L.corners}>
        <Choices
          value={theme.corners}
          options={cornerStyles}
          labels={L.options.corners}
          onChange={(corners) => change({ corners })}
        />
      </Section>

      {/* Save state, undo and preview, always at hand (thumb reach on a phone). */}
      <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="bg-surface border-line rounded-card mx-auto flex max-w-3xl items-center gap-2 border p-2 shadow-lg">
          <p
            role="status"
            className={`min-w-0 flex-1 ps-2 text-sm font-medium ${status === "error" ? "text-danger" : "text-ink-muted"}`}
          >
            {status === "saving" && (
              <LoaderCircle
                className="me-1 inline size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {status === "saving"
              ? L.saving
              : status === "saved"
                ? L.saved
                : status === "error"
                  ? L.saveError
                  : ""}
          </p>
          {history.length > 0 && (
            <button
              type="button"
              onClick={undo}
              className="btn-secondary min-h-11 px-3 whitespace-nowrap"
            >
              <Undo2 className="size-5" aria-hidden="true" />
              {L.undo}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="btn-primary min-h-11 px-4 whitespace-nowrap"
          >
            <Eye className="size-5" aria-hidden="true" />
            {L.preview}
          </button>
        </div>
      </div>

      {previewOpen && (
        <Preview
          slug={restaurant.slug}
          message={{ type: "mb-look", theme, logo_path: logo }}
          L={L}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

type LookStrings = ReturnType<typeof useI18n>["t"]["look"];

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card bg-surface shadow-card mt-6 p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {hint && <p className="text-ink-muted mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Choices<T extends string>({
  value,
  options,
  labels,
  onChange,
  preview,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  preview?: (value: T) => ReactNode;
}) {
  return (
    <div
      className={`grid gap-2 ${preview ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3"}`}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-control flex min-h-12 flex-col justify-center gap-1.5 border-2 p-2 text-center text-sm font-semibold ${
            value === option
              ? "border-brand bg-paprika-50"
              : "border-line bg-surface"
          }`}
        >
          {preview?.(option)}
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

function ColourRow({
  label,
  hint,
  value,
  choices,
  highlight = [],
  highlightLabel,
  pickLabel,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  choices: string[];
  highlight?: string[];
  highlightLabel?: string;
  pickLabel: string;
  onChange: (colour: string) => void;
}) {
  return (
    <fieldset className="mt-1 mb-5 last:mb-0">
      <legend className="font-semibold">{label}</legend>
      {hint && <p className="text-ink-muted text-sm">{hint}</p>}
      {highlight.length > 0 && highlightLabel && (
        <p className="text-ink-muted mt-2 text-xs font-semibold tracking-wide uppercase">
          {highlightLabel}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={value === c}
            aria-label={c}
            title={c}
            onClick={() => onChange(c)}
            className={`grid size-11 place-items-center rounded-full border ${
              value === c ? "ring-brand ring-2 ring-offset-2" : "border-line"
            } ${highlight.includes(c) ? "outline-mustard-400 outline-2 outline-offset-2 outline-dashed" : ""}`}
            style={{ background: c }}
          >
            {value === c && (
              <Check
                className="size-5"
                style={{ color: isLight(c) ? "#000" : "#fff" }}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
        <label className="border-line text-ink-muted relative grid h-11 cursor-pointer place-items-center rounded-full border border-dashed px-3 text-sm font-semibold">
          {pickLabel}
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </fieldset>
  );
}

function isLight(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 160;
}

/**
 * The cover as guests see it: the guest page shows it full width and at most 320 px high
 * (guest/Look.tsx), cropped from the middle. Phone ≈ 390 × 320, laptop ≈ 1440 × 320.
 */
const COVER_FRAMES = [
  { key: "coverPhone", ratio: 390 / 320 },
  { key: "coverLaptop", ratio: 1440 / 320 },
] as const;

function CoverPreview({ url, L }: { url: string; L: LookStrings }) {
  const [ratio, setRatio] = useState<number | null>(null);
  return (
    <div className="mt-5">
      <p className="font-semibold">{L.coverPreview}</p>
      <p className="text-ink-muted text-sm">{L.coverPreviewHint}</p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        {COVER_FRAMES.map((frame) => (
          <figure
            key={frame.key}
            className={frame.key === "coverPhone" ? "w-36" : "min-w-56 flex-1"}
          >
            <CoverFrame
              url={url}
              frame={frame.ratio}
              photo={ratio}
              onRatio={setRatio}
            />
            <figcaption className="text-ink-muted mt-1 text-sm">
              {L[frame.key]}
            </figcaption>
          </figure>
        ))}
      </div>
      {ratio !== null && (ratio > 1.6 || ratio < 0.9) && (
        <p className="bg-mustard-50 text-mustard-900 rounded-control mt-3 px-3 py-2 text-sm">
          {ratio > 1.6 ? L.coverTooWide : L.coverTooTall}
        </p>
      )}
    </div>
  );
}

/** The whole photo, dimmed, with the part guests see in a frame of the screen's shape. */
function CoverFrame({
  url,
  frame,
  photo,
  onRatio,
}: {
  url: string;
  frame: number;
  photo: number | null;
  onRatio: (ratio: number) => void;
}) {
  // Same as object-cover: the frame covers the photo's full height (photo wider) or width.
  const box =
    photo === null
      ? null
      : frame < photo
        ? { width: (frame / photo) * 100, height: 100 }
        : { width: 100, height: (photo / frame) * 100 };
  return (
    <div
      className="rounded-control border-line relative overflow-hidden border bg-black"
      style={{ aspectRatio: photo ?? frame }}
    >
      <img
        src={url}
        alt=""
        onLoad={(e) =>
          onRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
        }
        className="h-full w-full object-cover opacity-35 grayscale"
      />
      {box && (
        <div
          className="absolute overflow-hidden ring-2 ring-white"
          style={{
            width: `${box.width}%`,
            height: `${box.height}%`,
            left: `${(100 - box.width) / 2}%`,
            top: `${(100 - box.height) / 2}%`,
          }}
        >
          <img src={url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        </div>
      )}
    </div>
  );
}

function ImageSlot({
  label,
  hint,
  url,
  busy,
  contain,
  L,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  url: string | null;
  busy: boolean;
  contain?: boolean;
  L: LookStrings;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <p className="text-ink-muted text-sm">{hint}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-control border-line bg-oat-50 grid h-24 w-32 shrink-0 place-items-center overflow-hidden border border-dashed"
          aria-label={url ? `${L.replace}: ${label}` : `${L.add}: ${label}`}
        >
          {busy ? (
            <LoaderCircle
              className="text-brand size-6 animate-spin"
              aria-label={L.uploading}
            />
          ) : url ? (
            <img
              src={url}
              alt=""
              className={`h-full w-full ${contain ? "object-contain p-2" : "object-cover"}`}
            />
          ) : (
            <ImagePlus className="text-ink-muted size-7" aria-hidden="true" />
          )}
        </button>
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="text-brand-strong min-h-11 font-semibold"
          >
            {url ? L.replace : L.add}
          </button>
          {url && !busy && (
            <button
              type="button"
              onClick={onRemove}
              className="text-ink-muted min-h-11 font-medium"
            >
              {L.remove}
            </button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** The real guest page in a phone-sized frame, showing the draft as it is edited. */
function Preview({
  slug,
  message,
  L,
  onClose,
}: {
  slug: string;
  message: PreviewMessage;
  L: LookStrings;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(message);
  latest.current = message;

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        latest.current,
        location.origin,
      );
    const onMessage = (e: MessageEvent) => {
      if (
        e.origin === location.origin &&
        e.source === frame.current?.contentWindow &&
        (e.data as { type?: string } | null)?.type === "mb-preview-ready"
      )
        send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Every edit made while the preview is open (undo from the bar) shows at once.
  const key = JSON.stringify(message);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(JSON.parse(key), location.origin);
  }, [key]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={L.preview}
      className="bg-oat-950 m-0 h-dvh max-h-none w-full max-w-none p-0 backdrop:bg-black/60 sm:m-auto sm:h-[min(860px,94dvh)] sm:w-[400px] sm:rounded-[2rem]"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-white">
          <p className="min-w-0 flex-1 text-sm text-white/80">
            {L.previewHint}
          </p>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15"
            aria-label={L.close}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <iframe
          ref={frame}
          src={`/m/${slug}?preview`}
          title={L.preview}
          className="min-h-0 w-full flex-1 bg-white sm:rounded-b-[2rem]"
        />
      </div>
    </dialog>
  );
}
