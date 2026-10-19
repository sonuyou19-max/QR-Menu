import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router";
import {
  Check,
  CircleCheck,
  CircleX,
  LoaderCircle,
  LogOut,
  TriangleAlert,
} from "lucide-react";
import { LanguagePicker } from "../components/LanguagePicker";
import { Logo } from "../components/Logo";
import { useI18n } from "../i18n";
import { config } from "../lib/config";
import {
  defaultGuestLanguages,
  guestLanguageOptions,
  isValidSlug,
  languageName,
  menuLanguages,
  slugify,
} from "../lib/languages";
import { supabase } from "../lib/supabase";
import { useReloadRestaurant } from "../restaurant/RestaurantProvider";

type SlugState = "idle" | "checking" | "free" | "taken" | "invalid";
type ErrorKey = "name" | "languages" | "slug" | "generic";

/** First-time restaurant setup: name, menu language, guest languages, menu web address. */
export function Setup() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const reloadRestaurant = useReloadRestaurant();
  const ids = {
    name: useId(),
    address: useId(),
    source: useId(),
    slug: useId(),
  };

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<string>("nl");
  const [guestLanguages, setGuestLanguages] = useState<string[]>(
    defaultGuestLanguages,
  );
  const [showAllergens, setShowAllergens] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Suggest the web address from the name until the owner edits it.
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  // Check availability shortly after typing stops.
  useEffect(() => {
    if (!slug) return setSlugState("idle");
    if (!isValidSlug(slug)) return setSlugState("invalid");
    setSlugState("checking");
    let current = true;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_slug_available", {
        p_slug: slug,
      });
      if (current) setSlugState(error ? "idle" : data ? "free" : "taken");
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [slug]);

  const toggleGuest = (code: string) =>
    setGuestLanguages((list) =>
      list.includes(code) ? list.filter((l) => l !== code) : [...list, code],
    );

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Partial<Record<ErrorKey, boolean>> = {
      name: !name.trim(),
      languages:
        guestLanguages.filter((l) => l !== sourceLanguage).length === 0,
      slug: slugState !== "free",
    };
    setErrors(next);
    if (next.name || next.languages || next.slug) {
      const first = next.name ? ids.name : next.slug ? ids.slug : null;
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    const { data: created, error } = await supabase.rpc("create_restaurant", {
      p_name: name.trim(),
      p_slug: slug,
      p_address: address.trim(),
      p_source_language: sourceLanguage,
      p_guest_languages: guestLanguages,
    });
    if (error) {
      setSaving(false);
      if (error.code === "23505") {
        setSlugState("taken");
        setErrors({ slug: true });
        document.getElementById(ids.slug)?.focus();
      } else {
        setErrors({ generic: true });
        requestAnimationFrame(() => errorRef.current?.focus());
      }
      return;
    }
    // New restaurants show allergens by default; only an explicit "no" needs saving.
    if (!showAllergens && created)
      await supabase
        .from("restaurants")
        .update({ show_allergens: false })
        .eq("id", created.id);
    await reloadRestaurant();
    navigate("/", { replace: true });
  };

  const slugMessage = {
    idle: null,
    checking: (
      <span className="text-ink-muted flex items-center gap-1.5">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        {t.setup.slugChecking}
      </span>
    ),
    free: (
      <span className="text-success flex items-center gap-1.5">
        <CircleCheck className="size-4" aria-hidden="true" />
        {t.setup.slugFree}
      </span>
    ),
    taken: (
      <span className="text-danger flex items-center gap-1.5">
        <CircleX className="size-4" aria-hidden="true" />
        {t.setup.slugTaken}
      </span>
    ),
    invalid: (
      <span className="text-danger flex items-center gap-1.5">
        <CircleX className="size-4" aria-hidden="true" />
        {t.setup.slugInvalid}
      </span>
    ),
  }[slugState];

  const optional = (
    <span className="text-ink-muted font-normal"> ({t.setup.optional})</span>
  );

  return (
    <div className="min-h-dvh px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-12">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <span className="mr-auto">
          <Logo compact />
        </span>
        <LanguagePicker />
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="border-line bg-surface text-ink-muted grid size-10 place-items-center rounded-full border"
          aria-label={t.nav.logout}
          title={t.nav.logout}
        >
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </div>

      <main className="mx-auto mt-10 max-w-xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">{t.setup.title}</h1>
        <p className="text-ink-muted mt-2 text-lg">{t.setup.intro}</p>

        <form
          onSubmit={(e) => void submit(e)}
          noValidate
          className="mt-8 space-y-7"
        >
          {errors.generic && (
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
              {t.setup.errors.generic}
            </p>
          )}

          <div>
            <label htmlFor={ids.name} className="block font-semibold">
              {t.setup.name}
            </label>
            <input
              id={ids.name}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((x) => ({ ...x, name: false }));
              }}
              autoComplete="organization"
              maxLength={120}
              aria-invalid={errors.name || undefined}
              aria-describedby={errors.name ? `${ids.name}-error` : undefined}
              className="input mt-1.5"
            />
            {errors.name && (
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
              {optional}
            </label>
            <input
              id={ids.address}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              maxLength={200}
              className="input mt-1.5"
            />
          </div>

          <div>
            <label htmlFor={ids.source} className="block font-semibold">
              {t.setup.sourceLanguage}
            </label>
            <p className="text-ink-muted text-sm">
              {t.setup.sourceLanguageHint}
            </p>
            <select
              id={ids.source}
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
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
            <p className="text-ink-muted text-sm">
              {t.setup.guestLanguagesHint}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {guestLanguageOptions.map((code) => {
                const isSource = code === sourceLanguage;
                const checked = isSource || guestLanguages.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-disabled={isSource || undefined}
                    onClick={() => {
                      if (isSource) return;
                      toggleGuest(code);
                      if (errors.languages)
                        setErrors((x) => ({ ...x, languages: false }));
                    }}
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
            {errors.languages && (
              <p className="text-danger mt-2 text-sm font-medium" role="alert">
                {t.setup.errors.languages}
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="font-semibold">
              {t.setup.allergens.question}
            </legend>
            <p className="text-ink-muted text-sm">{t.setup.allergens.hint}</p>
            <div role="radiogroup" className="mt-3 grid gap-2">
              {([true, false] as const).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={showAllergens === value}
                  onClick={() => setShowAllergens(value)}
                  className={`rounded-control flex min-h-12 items-center gap-2 border px-4 py-2 text-left font-medium ${
                    showAllergens === value
                      ? "border-herb-700 bg-herb-50 text-herb-800"
                      : "border-line bg-surface text-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                      showAllergens === value
                        ? "border-herb-700"
                        : "border-oat-400"
                    }`}
                  >
                    {showAllergens === value && (
                      <span className="bg-herb-700 size-2.5 rounded-full" />
                    )}
                  </span>
                  {value ? t.setup.allergens.yes : t.setup.allergens.no}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={ids.slug} className="block font-semibold">
              {t.setup.webAddress}
            </label>
            <p className="text-ink-muted text-sm">{t.setup.webAddressHint}</p>
            <div
              className={`rounded-control bg-surface focus-within:outline-brand mt-1.5 flex items-center overflow-hidden border focus-within:outline-2 focus-within:outline-offset-2 ${
                errors.slug || slugState === "taken" || slugState === "invalid"
                  ? "border-danger"
                  : "border-line"
              }`}
            >
              <span className="bg-oat-100 text-ink-muted shrink-0 py-3 pr-1 pl-3.5 text-sm max-[379px]:hidden">
                {config.menuBase}
              </span>
              <input
                id={ids.slug}
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  if (errors.slug) setErrors((x) => ({ ...x, slug: false }));
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={60}
                aria-invalid={
                  errors.slug ||
                  slugState === "taken" ||
                  slugState === "invalid" ||
                  undefined
                }
                aria-describedby={`${ids.slug}-status`}
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-base outline-none"
              />
            </div>
            <p
              id={`${ids.slug}-status`}
              aria-live="polite"
              className="mt-1.5 min-h-5 text-sm font-medium"
            >
              {errors.slug && slugState === "idle" ? (
                <span className="text-danger">{t.setup.errors.slug}</span>
              ) : (
                slugMessage
              )}
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full text-lg"
          >
            {saving ? (
              <>
                <LoaderCircle
                  className="size-5 animate-spin"
                  aria-hidden="true"
                />
                {t.setup.saving}
              </>
            ) : (
              t.setup.submit
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
