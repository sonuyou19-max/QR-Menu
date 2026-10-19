// Shape of get_menu's answer and small helpers shared by the menu and the order screens.
import { config } from "../lib/config";
import type { Allergen } from "../lib/extraction";

export interface GuestDish {
  id: string;
  name: string;
  translated_name: string | null;
  price: number | null;
  description: string | null;
  description_is_typical: boolean;
  confidence: "known_dish" | "likely" | "unknown" | null;
  dietary: Partial<
    Record<
      | "vegetarian"
      | "vegan"
      | "contains_pork"
      | "contains_beef"
      | "contains_alcohol"
      | "spicy",
      boolean
    >
  >;
  /** Only when the restaurant shows allergens and the owner confirmed them. */
  allergens: Allergen[] | null;
  /** null when the restaurant doesn't show allergens at all. */
  allergens_confirmed: boolean | null;
  image_path: string | null;
  thumb_path: string | null;
  in_stock: boolean;
}

export interface GuestMenuData {
  restaurant: {
    name: string;
    slug: string;
    currency: string;
    source_language: string;
    languages: string[];
    language: string;
    show_allergens: boolean;
    is_published: boolean;
    /** Raw look settings; read with readTheme(). */
    theme: unknown;
    logo_path: string | null;
    /** The look's tagline in the guest's language; null: show it as written. */
    tagline_translated?: string | null;
  };
  categories: {
    id: string;
    name: string;
    translated_name: string | null;
    items: GuestDish[];
  }[];
}

/** Hide helper lines that only differ in spacing or punctuation ("Saag/ Kadai" vs "Saag/Kadai"). */
export const plain = (s: string) => s.toLowerCase().replace(/[\s\p{P}]/gu, "");
export function helperName(dish: {
  name: string;
  translated_name: string | null;
}) {
  return dish.translated_name &&
    plain(dish.translated_name) !== plain(dish.name)
    ? dish.translated_name
    : null;
}

export const dishImage = (path: string | null) =>
  path
    ? `${config.supabaseUrl}/storage/v1/object/public/dish-images/${path}`
    : null;
