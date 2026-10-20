import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Check,
  Languages,
  Lock,
  MessageCircle,
  Palette,
} from "lucide-react";
import { fill, useI18n } from "../i18n";
import { config } from "../lib/config";
import {
  guestLanguageOptions,
  languageName,
  menuLanguages,
} from "../lib/languages";
import { supabase } from "../lib/supabase";
import { Toast } from "../menu/Toast";
import type { Toast as ToastData } from "../menu/useMenuEditor";
import {
  useRestaurant,
  type Restaurant,
} from "../restaurant/RestaurantProvider";

type Fields = Pick<
  Restaurant,
  | "name"
  | "address"
  | "assistant_name"
  | "source_language"
  | "guest_languages"
  | "show_allergens"
>;
const TYPING_PAUSE_MS = 800;
/** Same rule as the database: letters (any script), spaces, - ' . — no digits, links or markup. */
const BAD_ASSISTANT_CHARS = /[0-9<>{}[\]\\/:@#$%^&*=+|~"`_\r\n\t]/;

/**
 * Restaurant details after setup (overview step 1): name, address, menu language, guest
 * languages, allergens. Saved as you go, with undo. The web address stays fixed: printed QR codes
 * point to it (CLAUDE.md 2).
 */
export function Settings() {
  const { t, lang } = useI18n();
  const { restaurant, reload } = useRestaurant();
  const s = t.settings;
  const ids = {
    name: useId(),
    address: useId(),
    assistant: useId(),
    source: useId(),
  };

  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [assistant, setAssistant] = useState(restaurant.assistant_name ?? "");
  const [assistantError, setAssistantError] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [languagesError, setLanguagesError] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saved = restaurant;
  const guestLanguages = saved.guest_languages;

  /** Save some fields; the toast offers to put back what they were. */
  const save = useCallback(
    async (patch: Partial<Fields>, before: Partial<Fields>) => {
      const { error } = await supabase
        .from("restaurants")
        .update(patch)
        .eq("id", restaurant.id);
      if (error) {
        setToast({
          id: Date.now(),
          message: t.editor.toast.error,
          error: true,
        });
        return;
      }
      await reload();
      setToast({
        id: Date.now(),
        message: t.editor.toast.saved,
        undo: async () => {
          await supabase
            .from("restaurants")
            .update(before)
            .eq("id", restaurant.id);
          if ("name" in before) setName(before.name ?? "");
          if ("address" in before) setAddress(before.address ?? "");
          if ("assistant_name" in before)
            setAssistant(before.assistant_name ?? "");
          if ("guest_languages" in before) setAdded([]);
          await reload();
          setToast(null);
        },
      });
    },
    [restaurant.id, reload, t],
  );

  // Name and address: saved after a short pause in typing, and when leaving the field. The timer
  // reads the latest values through a ref, not the ones from when it was started.
  const latest = useRef({ name, address, assistant, saved, save });
  latest.current = { name, address, assistant, saved, save };
  const saveText = useCallback(() => {
    if (typing.current) clearTimeout(typing.current);
    typing.current = null;
    const { name, address, assistant, saved, save } = latest.current;
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const trimmedAssistant = assistant.trim().replace(/\s+/g, " ");
    const assistantOk = !BAD_ASSISTANT_CHARS.test(trimmedAssistant);
    const patch: Partial<Fields> = {};
    const before: Partial<Fields> = {};
    if (trimmedName && trimmedName !== saved.name) {
      patch.name = trimmedName;
      before.name = saved.name;
    }
    if (trimmedAddress !== (saved.address ?? "")) {
      patch.address = trimmedAddress || null;
      before.address = saved.address;
    }
    if (assistantOk && trimmedAssistant !== (saved.assistant_name ?? "")) {
      patch.assistant_name = trimmedAssistant || null;
      before.assistant_name = saved.assistant_name;
    }
    setAssistantError(!assistantOk);
    setNameError(!trimmedName);
    if (Object.keys(patch).length) void save(patch, before);
  }, []);

  const textChanged = () => {
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(saveText, TYPING_PAUSE_MS);
  };
  useEffect(
    () => () => {
      if (typing.current) clearTimeout(typing.current);
    },
    [],
  );

  const setSource = (code: string) => {
    if (code === saved.source_language) return;
    // The menu's language always counts as a guest language.
    const guests = guestLanguages.includes(code)
      ? guestLanguages
      : [...guestLanguages, code];
    void save(
      { source_language: code, guest_languages: guests },
      {
        source_language: saved.source_language,
        guest_languages: saved.guest_languages,
      },
    );
  };

  const toggleGuest = (code: string) => {
    const next = guestLanguages.includes(code)
      ? guestLanguages.filter((l) => l !== code)
      : [...guestLanguages, code];
    if (next.filter((l) => l !== saved.source_language).length === 0) {
      setLanguagesError(true);
      return;
    }
    setLanguagesError(false);
    setAdded((list) =>
      next.includes(code) ? [...list, code] : list.filter((l) => l !== code),
    );
    void save(
      { guest_languages: next },
      { guest_languages: saved.guest_languages },
    );
  };

  const setAllergens = (value: boolean) => {
    if (value === saved.show_allergens) return;
    void save(
      { show_allergens: value },
      { show_allergens: saved.show_allergens },
    );
  };

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <div className="pb-24">
      <Link
        to="/"
        className="text-ink-muted inline-flex min-h-11 items-center gap-1.5 font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t.nav.overview}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{s.title}</h1>
      <p className="text-ink-muted mt-2 text-lg">{s.intro}</p>

      <div className="mt-8 max-w-xl space-y-7">
        <div>
          <label htmlFor={ids.name} className="block font-semibold">
            {t.setup.name}
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              textChanged();
            }}
            onBlur={saveText}
            autoComplete="organization"
            maxLength={120}
            aria-invalid={nameError || undefined}
            aria-describedby={nameError ? `${ids.name}-error` : undefined}
            className="input mt-1.5"
          />
          {nameError && (
            <p
              id={`${ids.name}-error`}
              className="text-danger mt-1.5 text-sm font-medium"
            >
              {t.setup.errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={ids.address} className="block font-semibold">
            {t.setup.address}
            <span className="text-ink-muted font-normal">
              {" "}
              ({t.setup.optional})
            </span>
          </label>
          <input
            id={ids.address}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              textChanged();
            }}
            onBlur={saveText}
            autoComplete="street-address"
            maxLength={200}
            className="input mt-1.5"
          />
        </div>

        <div>
          <label htmlFor={ids.assistant} className="block font-semibold">
            {s.assistantLabel}
            <span className="text-ink-muted font-normal">
              {" "}
              ({t.setup.optional})
            </span>
          </label>
          <p className="text-ink-muted text-sm">{s.assistantHint}</p>
          <input
            id={ids.assistant}
            value={assistant}
            onChange={(e) => {
              setAssistant(e.target.value);
              textChanged();
            }}
            onBlur={saveText}
            placeholder={s.assistantPlaceholder}
            autoComplete="off"
            maxLength={20}
            aria-invalid={assistantError || undefined}
            aria-describedby={`${ids.assistant}-preview${assistantError ? ` ${ids.assistant}-error` : ""}`}
            className="input mt-1.5"
          />
          {assistantError && (
            <p
              id={`${ids.assistant}-error`}
              className="text-danger mt-1.5 text-sm font-medium"
            >
              {s.assistantError}
            </p>
          )}
          <p
            id={`${ids.assistant}-preview`}
            className="text-ink-muted mt-2 flex flex-wrap items-center gap-2 text-sm"
          >
            {s.assistantPreview}
            <span className="bg-surface border-line text-ink inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 font-semibold">
              <MessageCircle
                className="text-brand-strong size-4"
                aria-hidden="true"
              />
              {assistant.trim()
                ? s.assistantButton.replace("{name}", assistant.trim())
                : s.assistantButtonDefault}
            </span>
          </p>
        </div>

        <div>
          <label htmlFor={ids.source} className="block font-semibold">
            {t.setup.sourceLanguage}
          </label>
          <p className="text-ink-muted text-sm">{t.setup.sourceLanguageHint}</p>
          <select
            id={ids.source}
            value={saved.source_language}
            onChange={(e) => setSource(e.target.value)}
            className="input mt-1.5"
          >
            {menuLanguages.map((code) => (
              <option key={code} value={code}>
                {languageName(code, lang)}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="font-semibold">{t.setup.guestLanguages}</legend>
          <p className="text-ink-muted text-sm">{s.guestLanguagesHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {guestLanguageOptions.map((code) => {
              const isSource = code === saved.source_language;
              const checked = isSource || guestLanguages.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-disabled={isSource || undefined}
                  onClick={() => !isSource && toggleGuest(code)}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-medium ${
                    checked
                      ? "border-herb-700 bg-herb-50 text-herb-800"
                      : "border-line bg-surface text-ink"
                  } ${isSource ? "cursor-default" : ""}`}
                >
                  {checked && <Check className="size-4" aria-hidden="true" />}
                  {languageName(code, lang)}
                  {isSource && (
                    <span className="text-ink-muted text-sm font-normal">
                      · {t.setup.menuLanguageTag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {languagesError && (
            <p className="text-danger mt-2 text-sm font-medium" role="alert">
              {t.setup.errors.languages}
            </p>
          )}
          {added.length > 0 && (
            <div className="rounded-card bg-mustard-50 mt-3 flex gap-3 p-4">
              <Languages
                className="text-mustard-800 mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <p>
                {fill(s.translateNote, {
                  languages: added.map((c) => languageName(c, lang)).join(", "),
                })}{" "}
                <Link
                  to="/menu"
                  className="text-brand-strong font-semibold underline underline-offset-2"
                >
                  {s.goToMenu}
                </Link>
              </p>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="font-semibold">
            {t.setup.allergens.question}
          </legend>
          <p className="text-ink-muted text-sm">{t.setup.allergens.hint}</p>
          <div role="radiogroup" className="mt-3 grid gap-2">
            {([true, false] as const).map((value) => {
              const on = saved.show_allergens === value;
              return (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAllergens(value)}
                  className={`rounded-control flex min-h-12 items-center gap-2 border px-4 py-2 text-left font-medium ${
                    on
                      ? "border-herb-700 bg-herb-50 text-herb-800"
                      : "border-line bg-surface text-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                      on ? "border-herb-700" : "border-oat-400"
                    }`}
                  >
                    {on && (
                      <span className="bg-herb-700 size-2.5 rounded-full" />
                    )}
                  </span>
                  {value ? t.setup.allergens.yes : t.setup.allergens.no}
                </button>
              );
            })}
          </div>
          {saved.show_allergens && (
            <p className="text-ink-muted mt-2 text-sm">{s.allergensNote}</p>
          )}
        </fieldset>

        <div>
          <p className="font-semibold">{t.setup.webAddress}</p>
          <p className="rounded-control bg-oat-100 text-ink mt-1.5 flex items-center gap-2 px-3.5 py-3 break-all">
            <Lock
              className="text-ink-muted size-4 shrink-0"
              aria-hidden="true"
            />
            {config.menuBase}
            {saved.slug}
          </p>
          <p className="text-ink-muted mt-1.5 text-sm">{s.webAddressLocked}</p>
        </div>

        <Link
          to="/look"
          className="rounded-card bg-surface shadow-card hover:bg-oat-50 flex items-center gap-3 p-4"
        >
          <Palette
            className="text-brand-strong size-6 shrink-0"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{s.lookTitle}</span>
            <span className="text-ink-muted block text-sm">{s.lookText}</span>
          </span>
        </Link>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
