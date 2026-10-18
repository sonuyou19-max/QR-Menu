import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import { Navigate, useLocation } from "react-router";
import {
  ArrowLeft,
  LoaderCircle,
  MailCheck,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { FullPageSpinner } from "../components/FullPageSpinner";
import { LanguagePicker } from "../components/LanguagePicker";
import { Logo } from "../components/Logo";
import { fill, useI18n } from "../i18n";
import { config } from "../lib/config";
import { loginLinkFailed } from "../lib/link-error";
import { supabase } from "../lib/supabase";

type ErrorKey =
  "email" | "rateLimit" | "emailLimit" | "linkExpired" | "generic";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AFTER_SECONDS = 60;

export function Login() {
  const { t } = useI18n();
  const { session } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<ErrorKey | null>(
    loginLinkFailed ? "linkExpired" : null,
  );
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [cooldown, setCooldown] = useState(0);
  const emailId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (session === undefined) return <FullPageSpinner />;
  if (session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
  }

  const send = async () => {
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError("email");
      return;
    }
    setError(null);
    setStatus("sending");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (authError) {
      setStatus(status === "sent" ? "sent" : "idle");
      // over_email_send_rate_limit: the project's hourly email quota is used up (not just this address).
      setError(
        authError.code === "over_email_send_rate_limit"
          ? "emailLimit"
          : authError.status === 429
            ? "rateLimit"
            : "generic",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setStatus("sent");
    setCooldown(RESEND_AFTER_SECONDS);
  };

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    void send();
  };

  const errorBox = error && error !== "email" && (
    <p
      ref={errorRef}
      tabIndex={-1}
      role="alert"
      className="rounded-control bg-paprika-50 text-danger flex gap-2 p-3 font-medium"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      {t.login.errors[error]}
    </p>
  );

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
        <Logo />
        <LanguagePicker />
      </div>

      <main className="mx-auto mt-12 w-full max-w-md flex-1">
        {status === "sent" ? (
          <div className="space-y-5">
            <MailCheck className="text-success size-12" aria-hidden="true" />
            <h1 className="text-3xl font-semibold">{t.login.sentTitle}</h1>
            <p className="text-lg">
              {fill(t.login.sentText, { email: email.trim() })}
            </p>
            <p className="text-ink-muted">{t.login.sentHint}</p>
            {errorBox}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void send()}
                disabled={cooldown > 0}
                className="btn-secondary"
              >
                {cooldown > 0
                  ? fill(t.login.resendIn, { seconds: cooldown })
                  : t.login.resend}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setError(null);
                }}
                className="btn text-brand"
              >
                {t.login.otherEmail}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <h1 className="text-3xl font-semibold sm:text-4xl">
              {t.login.title}
            </h1>
            <p className="text-ink-muted text-lg">{t.login.intro}</p>
            {errorBox}
            <div>
              <label htmlFor={emailId} className="block font-semibold">
                {t.login.email}
              </label>
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error === "email") setError(null);
                }}
                aria-invalid={error === "email" ? true : undefined}
                aria-describedby={
                  error === "email" ? `${emailId}-error` : undefined
                }
                className="input mt-1.5"
              />
              {error === "email" && (
                <p
                  id={`${emailId}-error`}
                  className="text-danger mt-1.5 text-sm font-medium"
                >
                  {t.login.errors.email}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={status === "sending"}
              className="btn-primary w-full text-lg"
            >
              {status === "sending" ? (
                <>
                  <LoaderCircle
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                  {t.login.sending}
                </>
              ) : (
                t.login.submit
              )}
            </button>
          </form>
        )}
      </main>

      <a
        href={config.siteUrl}
        className="text-ink-muted mx-auto flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t.login.backToSite}
      </a>
    </div>
  );
}
