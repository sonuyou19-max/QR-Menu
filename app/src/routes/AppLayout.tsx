import { LogOut } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";
import { LanguagePicker } from "../components/LanguagePicker";
import { fill, useI18n } from "../i18n";
import { supabase } from "../lib/supabase";

/** Shell for logged-in owner pages. */
export function AppLayout() {
  const { t } = useI18n();
  const { session } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="border-line/70 bg-canvas/90 sticky top-0 z-10 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link to="/" className="mr-auto">
            <Logo compact />
          </Link>
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
        <nav aria-label="MenuBuddy" className="mx-auto max-w-3xl px-2">
          <ul className="flex gap-1 overflow-x-auto">
            {(
              [
                ["/", t.nav.overview],
                ["/menu", t.nav.menu],
                ["/upload", t.nav.upload],
              ] as const
            ).map(([to, label]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center border-b-2 px-3 font-semibold whitespace-nowrap ${
                      isActive
                        ? "border-brand text-ink"
                        : "text-ink-muted border-transparent"
                    }`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="text-ink-muted mx-auto max-w-3xl px-4 pb-10 text-sm">
        {session?.user.email &&
          fill(t.nav.account, { email: session.user.email })}
      </footer>
    </div>
  );
}
