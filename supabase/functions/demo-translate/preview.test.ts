// deno test supabase/functions/demo-translate/preview.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { mergePreview, type PreviewPage } from "./preview.ts";

const item = (name: string, price: number | null = 10) => ({
  name,
  translated_name: null,
  price,
  price_text: price === null ? null : `€${price}`,
  description: null,
  description_is_typical: false,
});
const page = (
  categories: PreviewPage["categories"],
  is_menu = true,
): PreviewPage => ({
  is_menu,
  restaurant_name: null,
  source_language: "NL",
  currency: "eur",
  categories,
});

Deno.test(
  "pages merge in order; a continued category joins the previous one",
  () => {
    const preview = mergePreview(
      [
        page([
          {
            name: "Voorgerechten",
            translated_name: "Starters",
            continues_previous_page: false,
            items: [item("Kaaskroketten")],
          },
        ]),
        null,
        page([
          {
            name: "",
            translated_name: null,
            continues_previous_page: true,
            items: [item("Garnaalkroketten")],
          },
          {
            name: "Desserts",
            translated_name: "Desserts",
            continues_previous_page: false,
            items: [item("Dame blanche", -3)],
          },
        ]),
        page([], false),
      ],
      "en",
    );
    assertEquals(
      preview.categories.map((c) => [c.name, c.items.map((i) => i.name)]),
      [
        ["Voorgerechten", ["Kaaskroketten", "Garnaalkroketten"]],
        ["Desserts", ["Dame blanche"]],
      ],
    );
    assertEquals(preview.categories[1]!.items[0]!.price, null);
    assertEquals(
      [preview.source_language, preview.currency, preview.target_language],
      ["nl", "EUR", "en"],
    );
  },
);

Deno.test("no menu at all gives no categories", () => {
  assertEquals(mergePreview([page([], false), null], "fr").categories, []);
});
