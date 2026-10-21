/**
 * Three plans by restaurant size (owner's decision, CLAUDE.md 1): chosen by seats; menu visits
 * are only a check (we suggest the next plan after two months well above it, never charge
 * automatically). Annual = 10 months' price (2 months free). Prices excl. 21% VAT.
 */
export const plans = [
  { key: "small", monthly: 29, annual: 290, visitsPerMonth: 1000 },
  { key: "medium", monthly: 49, annual: 490, visitsPerMonth: 3000 },
  { key: "large", monthly: 79, annual: 790, visitsPerMonth: null },
] as const;

export type PlanKey = (typeof plans)[number]["key"];

/** What a plan costs per day, for the "That's €0.95 per day" line. */
export const perDay = (monthly: number) =>
  Math.round(((monthly * 12) / 365) * 100) / 100;

/** The annual price spread over 12 months. */
export const annualPerMonth = (annual: number) =>
  Math.round((annual / 12) * 100) / 100;
