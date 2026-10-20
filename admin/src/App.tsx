import { useEffect, useState, type SubmitEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { LoaderCircle, LogOut, MailCheck } from "lucide-react";
import { AiCosts } from "./AiCosts";
import { Leads } from "./Leads";
import { Restaurant } from "./Restaurant";
import { Restaurants } from "./Restaurants";
import { Today } from "./Today";
import { supabase } from "./supabase";

export function App() {
  const [session, setSession] = useState<Session | null | undefined>();
  const [founder, setFounder] = useState<boolean | undefined>();

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setFounder(undefined);
    if (!session) return;
    void supabase
      .rpc("is_founder")
      .then(({ data }) => setFounder(data === true));
  }, [session]);

  if (session === undefined || (session && founder === undefined))
    return (
      <div className="grid min-h-dvh place-items-center">
        <LoaderCircle
          className="text-ink-muted size-8 animate-spin"
          aria-label="Loading"
        />
      </div>
    );

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-12">
      <header className="flex items-center justify-between gap-3">
        <p className="font-display text-xl font-semibold">Brisolo HQ</p>
        {session && (
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="rounded-control border-line grid size-11 place-items-center border"
            aria-label="Log out"
          >
            <LogOut className="size-5" aria-hidden="true" />
          </button>
        )}
      </header>
      <main className="mt-4">
        {!session ? (
          <Login />
        ) : founder ? (
          <Dashboard />
        ) : (
          <p className="text-danger">
            This dashboard is only for the Brisolo team.
          </p>
        )}
      </main>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    // No sign-ups here: an address without an account simply gets no email. The answer is the
    // same either way, so the page doesn't reveal which addresses exist.
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${location.origin}/`,
      },
    });
    setState("sent");
  };

  if (state === "sent")
    return (
      <div className="space-y-4">
        <MailCheck className="text-success size-12" aria-hidden="true" />
        <h1 className="text-3xl font-semibold">Check your email</h1>
        <p className="text-ink-muted">
          If this address may use the dashboard, a login link is on its way.
          Open it on this phone.
        </p>
      </div>
    );

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-md space-y-4">
      <h1 className="text-3xl font-semibold">Log in</h1>
      <label className="block">
        <span className="mb-1.5 block font-semibold">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
      </label>
      <button
        type="submit"
        disabled={state === "sending"}
        className="btn-primary w-full"
      >
        Send login link
      </button>
    </form>
  );
}

const tabs = [
  { href: "#/", label: "Today", match: (p: string) => p === "/" },
  {
    href: "#/restaurants",
    label: "Restaurants",
    match: (p: string) => p.startsWith("/restaurants") || p.startsWith("/r/"),
  },
  { href: "#/leads", label: "Leads", match: (p: string) => p === "/leads" },
  { href: "#/costs", label: "Costs", match: (p: string) => p === "/costs" },
];

/** Screens live after the # (e.g. #/r/<id>), so the static host needs no routes. */
function useHashPath() {
  const read = () => location.hash.slice(1) || "/";
  const [path, setPath] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setPath(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}

function Dashboard() {
  const full = useHashPath();
  const [path, search = ""] = full.split("?");
  const restaurant = path!.match(/^\/r\/([0-9a-f-]{36})$/)?.[1];
  const screen = restaurant ? (
    <Restaurant key={restaurant} id={restaurant} />
  ) : path === "/restaurants" ? (
    <Restaurants
      key={search}
      initialFilter={new URLSearchParams(search).get("f") ?? undefined}
    />
  ) : path === "/leads" ? (
    <Leads />
  ) : path === "/costs" ? (
    <AiCosts />
  ) : (
    <Today />
  );
  return (
    <>
      <nav
        aria-label="Sections"
        className="bg-canvas/95 border-line sticky top-0 z-10 -mx-4 mb-5 flex gap-1 overflow-x-auto border-b px-4 backdrop-blur"
      >
        {tabs.map((t) => {
          const active = t.match(path!);
          return (
            <a
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex min-h-12 shrink-0 items-center border-b-2 px-3 font-semibold ${
                active
                  ? "border-brand text-ink"
                  : "text-ink-muted border-transparent"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </nav>
      {screen}
    </>
  );
}
