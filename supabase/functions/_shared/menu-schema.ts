// Menu extraction schema (CLAUDE.md 5). The model fills one PageResult per menu photo; the pages
// are merged into one MenuExtraction, which is what menu_uploads.raw_result stores.
import { z } from "npm:zod@4";

/** The 14 EU allergens (regulation 1169/2011). */
export const allergens = [
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

export const Dietary = z.object({
  vegetarian: z.boolean(),
  vegan: z.boolean(),
  contains_pork: z.boolean(),
  contains_beef: z.boolean(),
  contains_alcohol: z.boolean(),
  spicy: z.boolean(),
});

export const Item = z.object({
  name: z.string().describe("Dish name copied verbatim from the menu"),
  price: z
    .number()
    .nullable()
    .describe("Price as a number, null if missing or unreadable"),
  price_text: z
    .string()
    .nullable()
    .describe("Price exactly as printed, e.g. '€22,50'"),
  menu_description: z
    .string()
    .nullable()
    .describe("Description printed on the menu, verbatim; null if none"),
  typical_description: z
    .string()
    .nullable()
    .describe(
      "Only when menu_description is null and the dish is known: one short sentence on how it is typically made, in the menu's language",
    ),
  confidence: z.enum(["known_dish", "likely", "unknown"]),
  dietary: Dietary,
  suggested_allergens: z.array(z.enum(allergens)),
});

export const Category = z.object({
  name: z.string(),
  items: z.array(Item),
});

/** What the model returns for one photo. */
export const PageResult = z.object({
  is_menu: z
    .boolean()
    .describe("false if the photo does not show a menu at all"),
  restaurant_name: z.string().nullable(),
  source_language: z
    .string()
    .describe("ISO 639-1 code of the menu's language, e.g. 'nl'"),
  currency: z.string().describe("ISO 4217 code, e.g. 'EUR'"),
  categories: z.array(
    Category.extend({
      continues_previous_page: z
        .boolean()
        .describe(
          "true if this group has no heading of its own on this photo because it continues a category from the previous page",
        ),
    }),
  ),
  unreadable_sections: z.array(z.string()),
});
export type PageResult = z.infer<typeof PageResult>;

/** Stored in menu_uploads.raw_result. */
export const MenuExtraction = z.object({
  restaurant_name: z.string().nullable(),
  source_language: z.string(),
  currency: z.string(),
  categories: z.array(Category),
  unreadable_sections: z.array(z.string()),
});
export type MenuExtraction = z.infer<typeof MenuExtraction>;

/** What the model returns for one batch of texts to translate (publish-menu). */
export const TranslationBatch = z.object({
  entries: z.array(
    z.object({
      id: z.string().describe("The id exactly as given"),
      name: z
        .string()
        .nullable()
        .describe(
          "Helper translation of the name, or null for brands, proper names and names that need no translation",
        ),
      menu_description: z.string().nullable(),
      typical_description: z.string().nullable(),
    }),
  ),
});
export type TranslationBatch = z.infer<typeof TranslationBatch>;
