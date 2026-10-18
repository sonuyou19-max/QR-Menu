import { ListChecks, Store, Upload } from "lucide-react";
import { useI18n } from "../i18n";

const icons = [Store, Upload, ListChecks];

/** Owner start page. The steps become links as Phase 1 lands. */
export function Overview() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="text-3xl font-semibold sm:text-4xl">{t.overview.title}</h1>
      <p className="text-ink-muted mt-2 text-lg">{t.overview.intro}</p>
      <ol className="mt-8 space-y-3">
        {t.overview.steps.map((step, i) => {
          const Icon = icons[i]!;
          return (
            <li
              key={step.title}
              className="rounded-card bg-surface shadow-card flex items-start gap-4 p-5"
            >
              <span className="bg-paprika-100 text-paprika-700 grid size-11 shrink-0 place-items-center rounded-full">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">
                  {i + 1}. {step.title}
                </p>
                <p className="text-ink-muted mt-0.5">{step.text}</p>
              </div>
              <span className="bg-oat-100 text-oat-700 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold">
                {t.overview.soon}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
