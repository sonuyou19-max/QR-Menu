// "Book a demo" form (CLAUDE.md 4.6): honeypot + Cloudflare Turnstile → book-demo edge function.
import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import type { Dictionary, Lang } from "../../i18n";
import { loadTurnstile } from "./turnstile";

type FormCopy = Dictionary["form"];
type Field =
  | "name"
  | "restaurantName"
  | "city"
  | "email"
  | "phone"
  | "preferredTime"
  | "message";
type ErrorKey = keyof FormCopy["errors"];

export interface BookDemoFormProps {
  lang: Lang;
  t: FormCopy;
  privacyHref: string;
  endpoint: string;
  siteKey: string;
  contactEmail: string;
  /** Phone preview (claude.ai page): no network there, so validate and show the success state only. */
  previewMode?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BookDemoForm({
  lang,
  t,
  privacyHref,
  endpoint,
  siteKey,
  contactEmail,
  previewMode = false,
}: BookDemoFormProps) {
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    restaurantName: "",
    city: "",
    email: "",
    phone: "",
    preferredTime: "",
    message: "",
  });
  const [demoLang, setDemoLang] = useState<Lang>(lang);
  const [website, setWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<Field, ErrorKey>>
  >({});
  const [formError, setFormError] = useState<ErrorKey | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [token, setToken] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const id = (name: string) => `${uid}${name}`;

  // "Try with your own menu" links here with the restaurant name Buddy read from the photos.
  useEffect(() => {
    const restaurant = new URLSearchParams(window.location.search)
      .get("restaurant")
      ?.trim()
      .slice(0, 120);
    if (restaurant)
      setValues((v) =>
        v.restaurantName ? v : { ...v, restaurantName: restaurant },
      );
  }, []);

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

  // The thank-you card is much shorter than the form: bring it into view on phones.
  useEffect(() => {
    if (status !== "done") return;
    successRef.current?.scrollIntoView({ block: "center" });
    successRef.current?.focus({ preventScroll: true });
  }, [status]);

  const set = (field: Field) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (fieldErrors[field])
      setFieldErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const errors: Partial<Record<Field, ErrorKey>> = {};
    if (!values.name.trim()) errors.name = "required";
    if (!values.email.trim()) errors.email = "required";
    else if (!EMAIL_RE.test(values.email.trim())) errors.email = "email";
    setFieldErrors(errors);
    const firstInvalid = (["name", "email"] as const).find((f) => errors[f]);
    if (firstInvalid) {
      document.getElementById(id(firstInvalid))?.focus();
      return;
    }
    if (previewMode) {
      setStatus("done");
      return;
    }
    if (!token) {
      setFormError("captchaPending");
      return;
    }

    setStatus("sending");
    let error: ErrorKey | null = null;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(
            Object.entries(values).map(([k, v]) => [k, v.trim()]),
          ),
          language: demoLang,
          website,
          turnstileToken: token,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!data.ok) {
        error =
          data.error === "captcha" || data.error === "rate_limited"
            ? data.error
            : "server";
      }
    } catch {
      error = "server";
    }
    if (!error) {
      setStatus("done");
      return;
    }
    setStatus("idle");
    setFormError(error);
    // A Turnstile token is single-use: get a fresh one for the next attempt.
    setToken("");
    if (window.turnstile && widgetId.current)
      window.turnstile.reset(widgetId.current);
    requestAnimationFrame(() => formErrorRef.current?.focus());
  };

  if (status === "done") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-card bg-herb-50 p-8 text-center"
      >
        <CircleCheck
          className="text-success mx-auto size-12"
          aria-hidden="true"
        />
        <p className="font-display mt-4 text-3xl font-semibold">
          {t.successTitle}
        </p>
        <p className="text-ink-muted mt-2 text-lg">{t.successText}</p>
        {previewMode && (
          <p className="text-ink-muted mt-4 text-sm">{t.previewNote}</p>
        )}
      </div>
    );
  }

  const input =
    "mt-1.5 w-full rounded-control border bg-surface px-3.5 py-3 text-base text-ink placeholder:text-oat-500 aria-invalid:border-danger";
  const label = "block font-semibold";
  const field = (
    name: Field,
    type = "text",
    opts: {
      required?: boolean;
      autoComplete?: string;
      placeholder?: string;
    } = {},
  ) => (
    <div>
      <label htmlFor={id(name)} className={label}>
        {t[name]}
        {!opts.required && (
          <span className="text-ink-muted font-normal"> ({t.optional})</span>
        )}
      </label>
      <input
        id={id(name)}
        name={name}
        type={type}
        value={values[name]}
        onChange={(e) => set(name)(e.target.value)}
        autoComplete={opts.autoComplete}
        placeholder={opts.placeholder}
        aria-required={opts.required}
        aria-invalid={fieldErrors[name] ? true : undefined}
        aria-describedby={fieldErrors[name] ? id(`${name}-error`) : undefined}
        className={`${input} ${fieldErrors[name] ? "border-danger" : "border-line"}`}
      />
      {fieldErrors[name] && (
        <p
          id={id(`${name}-error`)}
          className="text-danger mt-1.5 text-sm font-medium"
        >
          {t.errors[fieldErrors[name]!]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {field("name", "text", { required: true, autoComplete: "name" })}
      {field("restaurantName", "text", { autoComplete: "organization" })}
      <div className="grid gap-5 sm:grid-cols-2">
        {field("email", "email", { required: true, autoComplete: "email" })}
        {field("phone", "tel", { autoComplete: "tel" })}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {field("city", "text", { autoComplete: "address-level2" })}
        <div>
          <label htmlFor={id("language")} className={label}>
            {t.language}
          </label>
          <select
            id={id("language")}
            value={demoLang}
            onChange={(e) => setDemoLang(e.target.value as Lang)}
            className={`${input} border-line`}
          >
            {(Object.keys(t.languageOptions) as Lang[]).map((l) => (
              <option key={l} value={l}>
                {t.languageOptions[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {field("preferredTime", "text", {
        placeholder: t.preferredTimePlaceholder,
      })}
      <div>
        <label htmlFor={id("message")} className={label}>
          {t.message}{" "}
          <span className="text-ink-muted font-normal">({t.optional})</span>
        </label>
        <textarea
          id={id("message")}
          value={values.message}
          onChange={(e) => set("message")(e.target.value)}
          placeholder={t.messagePlaceholder}
          rows={4}
          maxLength={2000}
          className={`${input} border-line`}
        />
      </div>

      {/* Honeypot: off-screen for people, tempting for bots. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor={id("website")}>{t.honeypot}</label>
        <input
          id={id("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div ref={widgetRef} />

      {formError && (
        <p
          ref={formErrorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-control bg-paprika-50 text-danger flex gap-2 p-3 font-medium"
        >
          <TriangleAlert
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          {t.errors[formError].replace("{email}", contactEmail)}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary w-full text-lg disabled:opacity-70"
      >
        {status === "sending" ? (
          <>
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            {t.sending}
          </>
        ) : (
          t.submit
        )}
      </button>
      <p className="text-ink-muted text-sm">
        {t.privacy}{" "}
        <a
          href={privacyHref}
          className="text-brand font-medium underline underline-offset-2"
        >
          {t.privacyLink}
        </a>
      </p>
    </form>
  );
}
