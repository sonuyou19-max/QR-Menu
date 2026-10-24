// Allergen icons for the guest menu: a small coloured circle per confirmed allergen, so a long menu
// reads at a glance. Names stay in the dish sheet and in the legend at the bottom of the menu.
import {
  Bean,
  Droplet,
  Egg,
  Fish,
  Flower,
  LeafyGreen,
  Milk,
  Nut,
  Shell,
  Shrimp,
  Sprout,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { allergenCodes, type Allergen } from "../lib/extraction";
import type { GuestStrings } from "./strings";

const icons: Record<Allergen, { Icon: LucideIcon; tone: string }> = {
  gluten: { Icon: Wheat, tone: "bg-mustard-100 text-mustard-800" },
  crustaceans: { Icon: Shrimp, tone: "bg-paprika-100 text-paprika-800" },
  eggs: { Icon: Egg, tone: "bg-mustard-50 text-mustard-700" },
  fish: { Icon: Fish, tone: "bg-sky-100 text-sky-800" },
  peanuts: { Icon: Nut, tone: "bg-orange-100 text-orange-800" },
  soybeans: { Icon: Bean, tone: "bg-herb-100 text-herb-800" },
  milk: { Icon: Milk, tone: "bg-sky-50 text-sky-700" },
  nuts: { Icon: Nut, tone: "bg-oat-200 text-oat-900" },
  celery: { Icon: LeafyGreen, tone: "bg-herb-50 text-herb-700" },
  mustard: { Icon: Droplet, tone: "bg-yellow-100 text-yellow-800" },
  sesame: { Icon: Sprout, tone: "bg-oat-100 text-oat-800" },
  sulphites: { Icon: Wine, tone: "bg-rose-100 text-rose-800" },
  lupin: { Icon: Flower, tone: "bg-violet-100 text-violet-800" },
  molluscs: { Icon: Shell, tone: "bg-cyan-100 text-cyan-800" },
};

/** One allergen as a circle; `title` names it on hover, the parent carries the spoken text. */
export function AllergenIcon({
  allergen,
  s,
  size = "sm",
}: {
  allergen: Allergen;
  s: GuestStrings;
  size?: "sm" | "md";
}) {
  const { Icon, tone } = icons[allergen];
  return (
    <span
      title={s.allergenNames[allergen]}
      className={`ring-canvas inline-grid shrink-0 place-items-center rounded-full ring-2 ${tone} ${size === "sm" ? "size-6" : "size-8"}`}
    >
      <Icon
        className={size === "sm" ? "size-3.5" : "size-4.5"}
        aria-hidden="true"
      />
    </span>
  );
}

/** A dish's confirmed allergens as overlapping circles, the first `max` and "+N" for the rest. */
export function AllergenIcons({
  allergens,
  s,
  max = 4,
}: {
  allergens: Allergen[];
  s: GuestStrings;
  max?: number;
}) {
  const shown =
    allergens.length > max ? allergens.slice(0, max - 1) : allergens;
  const rest = allergens.length - shown.length;
  return (
    <span className="mt-2 flex items-center">
      <span className="sr-only">
        {s.allergens}: {allergens.map((a) => s.allergenNames[a]).join(", ")}
      </span>
      <span aria-hidden="true" className="flex -space-x-1 rtl:space-x-reverse">
        {shown.map((a) => (
          <AllergenIcon key={a} allergen={a} s={s} />
        ))}
        {rest > 0 && (
          <span className="bg-ink text-canvas ring-canvas inline-grid size-6 place-items-center rounded-full text-[11px] font-bold ring-2">
            +{rest}
          </span>
        )}
      </span>
    </span>
  );
}

/** The icons used on this menu with their names, for the bottom of the page. */
export function AllergenLegend({
  used,
  s,
}: {
  used: Set<Allergen>;
  s: GuestStrings;
}) {
  const list = allergenCodes.filter((a) => used.has(a));
  if (!list.length) return null;
  return (
    <section className="border-line mt-10 border-t pt-6 text-start">
      <h2 className="text-ink text-sm font-semibold">{s.allergenKey}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {list.map((a) => (
          <li key={a} className="flex items-center gap-2">
            <AllergenIcon allergen={a} s={s} />
            <span>{s.allergenNames[a]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
