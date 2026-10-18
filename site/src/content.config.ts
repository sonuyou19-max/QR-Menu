import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** Privacy policy and terms, one Markdown file per page and language: legal/{lang}/{page}.md */
const legal = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/legal" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.coerce.date(),
    /** Shows a "draft, needs legal review" banner. Remove once a lawyer has checked the text. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { legal };
