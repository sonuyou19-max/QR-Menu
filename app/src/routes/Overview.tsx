import { Check, ListChecks, Store, Upload } from "lucide-react";
import { useI18n } from "../i18n";
import { config } from "../lib/config";
import { languageName } from "../lib/languages";
import { useRestaurant } from "../restaurant/RestaurantProvider";

const icons = [Store, Upload, ListChecks];

/** Owner start page. Steps become links as Phase 1 lands. */
export function Overview() {
  const { t, lang } = useI18n();
  const { restaurant } = useRestaurant();
  const doneSteps = 1; // Restaurant set up; upload and publish come next.
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
          return (
            <li
              key={step.title}
              className="rounded-card bg-surface shadow-card flex items-start gap-4 p-5"
            >
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
                  done ? "bg-herb-100 text-herb-800" : "bg-oat-100 text-oat-700"
                }`}
              >
                {done ? t.overviewExtra.done : t.overview.soon}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
