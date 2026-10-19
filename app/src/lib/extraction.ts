// Shape of menu_uploads.raw_result, written by the process-menu edge function.
// Mirrors MenuExtraction in supabase/functions/_shared/menu-schema.ts (CLAUDE.md 5).

export const allergenCodes = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;
export type Allergen = (typeof allergenCodes)[number];

export interface ExtractedItem {
  name: string;
  price: number | null;
  price_text: string | null;
  menu_description: string | null;
  typical_description: string | null;
  confidence: "known_dish" | "likely" | "unknown";
  dietary: {
    vegetarian: boolean;
    vegan: boolean;
    contains_pork: boolean;
    contains_beef: boolean;
    contains_alcohol: boolean;
    spicy: boolean;
  };
  suggested_allergens: Allergen[];
}

export interface MenuExtraction {
  restaurant_name: string | null;
  source_language: string;
  currency: string;
  categories: { name: string; items: ExtractedItem[] }[];
  unreadable_sections: string[];
}

/** Error codes process-menu stores in menu_uploads.error. */
export type UploadError =
  | "not_a_menu"
  | "unreadable"
  | "server"
  // Website import (process-menu/website.ts)
  | "bad_url"
  | "social_site"
  | "site_unreachable"
  | "no_menu_found";

/** Same limits as the edge function. */
export const MAX_PHOTOS = 8;
/** A run still "processing" after this long has died (the function stops after ~2.5 min). */
export const STALE_AFTER_MS = 5 * 60 * 1000;
