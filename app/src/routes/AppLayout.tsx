import { LogOut } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";
import { LanguagePicker } from "../components/LanguagePicker";
import { fill, useI18n } from "../i18n";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

/** Shell for logged-in owner pages. */
export function AppLayout() {
  const { role } = useRestaurant();
  const { t } = useI18n();
  const { session } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="border-line/70 bg-canvas/90 sticky top-0 z-10 border-b pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
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
        <nav aria-label="Brisolo" className="mx-auto max-w-3xl px-2">
          <ul className="flex justify-between gap-0.5 overflow-x-auto sm:justify-start sm:gap-1">
            {(role === "staff"
              ? ([["/service", t.nav.service]] as const)
              : ([
                  ["/", t.nav.overview],
                  ["/service", t.nav.service],
                  ["/menu", t.nav.menu],
                  ["/upload", t.nav.upload],
                  ["/look", t.nav.look],
                  ["/qr", t.nav.qr],
                ] as const)
            ).map(([to, label]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center border-b-2 px-1.5 text-[0.9375rem] font-semibold whitespace-nowrap sm:px-3 sm:text-base ${
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
      <main className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
        <Outlet />
      </main>
      <footer className="text-ink-muted mx-auto max-w-3xl px-4 pb-10 text-sm print:hidden">
        {session?.user.email &&
          fill(t.nav.account, { email: session.user.email })}
      </footer>
    </div>
  );
}
