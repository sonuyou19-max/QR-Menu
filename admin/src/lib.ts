// Shared data shapes, formatting and data loading for Brisolo HQ. All numbers come from the
// hq_* database functions, which answer null to anyone who is not a founder.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export const locale = "en-GB";
export const appUrl =
  import.meta.env.VITE_APP_URL || "https://menubuddy-app.sonuyou19.workers.dev";
/** Monthly list price per plan size (excl. VAT); annual = 10 months. */
export const sizePrices = { small: 29, medium: 49, large: 79 } as const;

export type Stage = "setup" | "live" | "quiet";
export type Plan = "pilot" | "monthly" | "annual";
export type PlanSize = keyof typeof sizePrices;

export interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  plan: Plan;
  plan_size: PlanSize;
  seats: number | null;
  mrr: number;
  trial_ends_at: string | null;
  created_at: string;
  published_at: string | null;
  is_published: boolean;
  is_demo: boolean;
  owner_email: string | null;
  source_language: string;
  guest_languages: string[];
  dishes: number;
  visits_7d: number;
  visits_prev_7d: number;
  visits_30d: number;
  visits_prev_30d: number;
  /** Menu visits a month the plan expects; null = no limit (large). */
  visit_limit: number | null;
  /** Above the limit in both of the last two 30-day periods. */
  above_plan: boolean;
  last_visit: string | null;
  questions_30d: number;
  flagged_30d: number;
  ai_eur_month: number;
  translation_failed: boolean;
  last_upload: {
    status: string;
    error: string | null;
    source: string;
    at: string;
  } | null;
  stage: Stage;
}

export interface RestaurantDetail extends RestaurantRow {
  members: { email: string; role: string }[];
  per_day: { day: string; visits: number }[];
  languages: { language: string; visits: number }[];
  ai_jobs: { kind: string; calls: number; tokens: number; eur: number }[];
  uploads: {
    source: string;
    status: string;
    error: string | null;
    at: string;
  }[];
  questions: {
    question: string;
    answer: string;
    type: string;
    flagged: boolean;
    language: string;
    at: string;
  }[];
}

export interface AttentionItem {
  id: string;
  name: string;
  note?: string | null;
  at?: string | null;
  /** Menu visits in the last 30 days (above_plan). */
  visits?: number;
}
export interface AttentionGroup {
  count: number;
  items: AttentionItem[];
}
export interface Overview {
  kpis: {
    mrr: number;
    paying: number;
    pilots: number;
    restaurants: number;
    live: number;
    setup: number;
    quiet: number;
    new_this_month: number;
    visits_7d: number;
    visits_prev_7d: number;
    ai_eur_month: number;
  };
  per_day: { day: string; visits: number }[];
  funnel: Record<
    "leads" | "signed_up" | "menu_read" | "online" | "guests" | "paying",
    number
  >;
  attention: Record<
    | "new_leads"
    | "stuck_setup"
    | "quiet"
    | "trial_ending"
    | "failed_imports"
    | "translation_failed"
    | "flagged_answers"
    | "above_plan"
    | "high_ai_cost",
    AttentionGroup
  >;
}

export type LeadStatus =
  "new" | "contacted" | "demo_done" | "pilot" | "won" | "lost";
export interface Lead {
  id: string;
  name: string;
  restaurant_name: string | null;
  city: string | null;
  email: string;
  phone: string | null;
  language: string | null;
  preferred_time: string | null;
  message: string | null;
  source: "book_demo" | "try_your_menu";
  status: LeadStatus;
  created_at: string;
}

export const leadStatuses: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "demo_done", label: "Demo done" },
  { key: "pilot", label: "Pilot" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export const stageLabels: Record<Stage, string> = {
  live: "Online",
  quiet: "Quiet",
  setup: "Setting up",
};
export const planLabels: Record<Plan, string> = {
  pilot: "Pilot (free)",
  monthly: "Monthly",
  annual: "Annual",
};
export const sizeLabels: Record<PlanSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};
/** "Medium · €49/month", "Small · pilot". */
export function planText(r: { plan: Plan; plan_size: PlanSize }): string {
  const price = sizePrices[r.plan_size];
  return `${sizeLabels[r.plan_size]} · ${
    r.plan === "pilot"
      ? "pilot"
      : r.plan === "annual"
        ? `€${price * 10}/year`
        : `€${price}/month`
  }`;
}
/** The plan the seats point to: up to 40 small, up to 100 medium, more large. */
export const sizeForSeats = (seats: number): PlanSize =>
  seats <= 40 ? "small" : seats <= 100 ? "medium" : "large";

export const jobLabels: Record<string, string> = {
  extract: "Reading menus",
  translate: "Translating",
  chat: "Guest chat",
  theme: "Look suggestions",
  dish: "Dish suggestions",
  demo: "Website demo previews",
};

/** Load one hq_* function; null data means "not a founder" or an error. */
export function useRpc<T>(fn: string, args?: Record<string, unknown>) {
  const key = JSON.stringify(args ?? {});
  const [data, setData] = useState<T | null | undefined>(undefined);
  const load = useCallback(async () => {
    const { data: result, error } = await supabase.rpc(
      fn,
      JSON.parse(key) as Record<string, unknown>,
    );
    setData(error ? null : ((result as T | null) ?? null));
  }, [fn, key]);
  useEffect(() => {
    setData(undefined);
    void load();
  }, [load]);
  return { data, setData, reload: load };
}

export const eur = (n: number, precise = false) => {
  const decimals = precise || (n > 0 && n < 10) ? 2 : 0;
  return n.toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: precise && n > 0 && n < 0.1 ? 3 : decimals,
  });
};
export const num = (n: number) => n.toLocaleString(locale);
export const date = (iso: string) =>
  new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year:
      new Date(iso).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });

/** "3 h ago", "yesterday", "12 days ago", "in 5 days". */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const future = minutes < 0;
  const m = Math.abs(minutes);
  const text =
    m < 60
      ? `${Math.max(m, 1)} min`
      : m < 60 * 24
        ? `${Math.round(m / 60)} h`
        : `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? "" : "s"}`;
  return future ? `in ${text}` : `${text} ago`;
}

const languageNames = new Intl.DisplayNames([locale], { type: "language" });
export const languageName = (code: string) => {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
};

/** Change against the previous period, as text: "+12%", "−3", "new". */
export function change(now: number, before: number): string | null {
  if (before === 0) return now > 0 ? "new" : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return null;
  return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)}%`;
}
