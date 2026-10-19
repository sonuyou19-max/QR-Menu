// deno test supabase/functions/_shared/chat-guard.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { groundingMenu, guard, type GuestMenu } from "./chat-guard.ts";

const dish = (id: string, name: string, price: number | null, extra = {}) => ({
  id,
  name,
  translated_name: null,
  price,
  description: null,
  description_is_typical: false,
  confidence: "known_dish",
  dietary: {},
  allergens: ["gluten"],
  allergens_confirmed: true,
  in_stock: true,
  ...extra,
});
const menu: GuestMenu = {
  restaurant: {
    name: "T",
    currency: "EUR",
    language: "en",
    show_allergens: true,
    is_published: true,
  },
  categories: [
    {
      name: "Mains",
      translated_name: null,
      items: [
        dish("u-stoof", "Stoofvlees", 22.5),
        dish("u-water", "Waterzooi", 23, {
          allergens: null,
          allergens_confirmed: false,
        }),
        dish("u-moss", "Mosselen", 28, { in_stock: false }),
      ],
    },
  ],
};
const { refs, json } = groundingMenu(menu);

Deno.test("refs map to real dishes; unknown refs are dropped", () => {
  const r = guard(
    {
      answer: "Try the stew.",
      referenced_dishes: ["d1", "d9", "D1"],
      answer_type: "menu_fact",
      allergen_question: false,
    },
    refs,
    true,
  );
  assertEquals(r.dishIds, ["u-stoof"]);
  assertEquals(r.notice, null);
});

Deno.test("a wrong price sentence is removed, a right one kept", () => {
  const r = guard(
    {
      answer: "The stew costs €22,50. Today it is only €5!",
      referenced_dishes: ["d1"],
      answer_type: "menu_fact",
      allergen_question: false,
    },
    refs,
    true,
  );
  assertEquals(r.answer, "The stew costs €22,50.");
  assertEquals(r.strippedPrices, true);
});

Deno.test("an answer with only a wrong price becomes null", () => {
  const r = guard(
    {
      answer: "It costs 5 EUR.",
      referenced_dishes: ["d1"],
      answer_type: "menu_fact",
      allergen_question: false,
    },
    refs,
    true,
  );
  assertEquals(r.answer, null);
});

Deno.test("two of a dish is a valid amount", () => {
  const r = guard(
    {
      answer: "Two stews are 45 euro.",
      referenced_dishes: ["d1"],
      answer_type: "menu_fact",
      allergen_question: false,
    },
    refs,
    true,
  );
  assertEquals(r.answer, "Two stews are 45 euro.");
});

Deno.test(
  "allergen question about an unconfirmed dish gets the fixed notice",
  () => {
    const r = guard(
      {
        answer: "Ask staff.",
        referenced_dishes: ["d2"],
        answer_type: "cannot_answer",
        allergen_question: true,
      },
      refs,
      true,
    );
    assertEquals(r.notice, "allergens_unconfirmed");
  },
);

Deno.test(
  "allergens switched off: notice and no allergen data for the model",
  () => {
    const r = guard(
      {
        answer: "Ask staff.",
        referenced_dishes: ["d1"],
        answer_type: "cannot_answer",
        allergen_question: true,
      },
      refs,
      false,
    );
    assertEquals(r.notice, "allergens_off");
    const off = groundingMenu({
      ...menu,
      restaurant: { ...menu.restaurant, show_allergens: false },
    }).json;
    assertEquals(JSON.stringify(off).includes("allergen"), true); // only the allergens_shown flag
    assertEquals(JSON.stringify(off.categories).includes("allergen"), false);
  },
);

Deno.test("grounding marks sold-out dishes and confirmed allergens", () => {
  const d = json.categories[0]!.dishes;
  assertEquals(d[2]!.available_today, false);
  assertEquals(
    (d[0] as { allergens_confirmed?: string[] }).allergens_confirmed,
    ["gluten"],
  );
  assertEquals(
    (d[1] as { allergens?: string }).allergens,
    "not confirmed by the restaurant",
  );
});

Deno.test("internal dish refs never reach the guest", () => {
  const r = guard({ answer: "Try the Stoofvlees (d1) or d2.", referenced_dishes: ["d1", "d2"], answer_type: "menu_fact", allergen_question: false }, refs, true);
  assertEquals(r.answer, "Try the Stoofvlees or.");
});
