import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, ChevronRight, ListChecks, Store, Upload } from "lucide-react";
import { useI18n } from "../i18n";
import { config } from "../lib/config";
import { languageName } from "../lib/languages";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

const icons = [Store, Upload, ListChecks];
/** Steps that already have a screen. */
const stepLinks: (string | null)[] = [null, "/upload", "/menu"];

/** Owner start page. Steps become links as Phase 1 lands. */
export function Overview() {
  const { t, lang } = useI18n();
  const { restaurant } = useRestaurant();
  const [menuRead, setMenuRead] = useState(false);

  useEffect(() => {
    void supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .then(({ count }) => setMenuRead((count ?? 0) > 0));
  }, [restaurant.id]);

  // Restaurant set up; the upload step counts once the menu has dishes. Publishing is step 6.
  const doneSteps = menuRead ? 2 : 1;
  return (
    <div>
      <h1 className="text-3xl font-semibold sm:text-4xl">{restaurant.name}</h1>
      <dl className="text-ink-muted mt-3 space-y-1">
        <div>
          <dt className="inline">{t.overviewExtra.menuAt}: </dt>
          <dd className="text-ink inline font-medium break-all">
            {config.menuBase}
            {restaurant.slug}
          </dd>
        </div>
        <div>
          <dt className="inline">{t.overviewExtra.languages}: </dt>
          <dd className="text-ink inline">
            {restaurant.guest_languages
              .map((code) => languageName(code, lang))
              .join(", ")}
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-lg">{t.overview.intro}</p>
      <ol className="mt-4 space-y-3">
        {t.overview.steps.map((step, i) => {
          const Icon = icons[i]!;
          const done = i < doneSteps;
          const link = stepLinks[i];
          const content = (
            <>
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-full ${
                  done
                    ? "bg-herb-100 text-herb-800"
                    : "bg-paprika-100 text-paprika-700"
                }`}
              >
                {done ? (
                  <Check className="size-5" aria-hidden="true" />
                ) : (
                  <Icon className="size-5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">
                  {i + 1}. {step.title}
                </p>
                <p className="text-ink-muted mt-0.5">{step.text}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  done
                    ? "bg-herb-100 text-herb-800"
                    : link
                      ? "bg-paprika-100 text-paprika-800"
                      : "bg-oat-100 text-oat-700"
                }`}
              >
                {done
                  ? t.overviewExtra.done
                  : link
                    ? t.overviewExtra.open
                    : t.overview.soon}
              </span>
              {link && (
                <ChevronRight
                  className="text-ink-muted size-5 shrink-0 self-center"
                  aria-hidden="true"
                />
              )}
            </>
          );
          const card =
            "rounded-card bg-surface shadow-card flex items-start gap-4 p-5";
          return (
            <li key={step.title}>
              {link ? (
                <Link to={link} className={`${card} hover:bg-oat-50`}>
                  {content}
                </Link>
              ) : (
                <div className={card}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
