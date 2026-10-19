import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Check,
  ChevronRight,
  ListChecks,
  Palette,
  QrCode,
  Store,
  Upload,
} from "lucide-react";
import { fill, useI18n } from "../i18n";
import { config, isLiveDomain, menuUrl } from "../lib/config";
import { languageName } from "../lib/languages";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

const icons = [Store, Upload, ListChecks, Palette, QrCode];
/** Steps that already have a screen. */
const stepLinks: (string | null)[] = [null, "/upload", "/menu", "/look", "/qr"];

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

  // Set up, menu has dishes, published (translated), own look chosen; the QR code stays open.
  const hasLook =
    !!restaurant.theme &&
    typeof restaurant.theme === "object" &&
    Object.keys(restaurant.theme).length > 0;
  const doneSteps = [true, menuRead, restaurant.is_published, hasLook, false];
  return (
    <div>
      <h1 className="text-3xl font-semibold sm:text-4xl">{restaurant.name}</h1>
      <dl className="text-ink-muted mt-3 space-y-1">
        <div>
          <dt className="inline">{t.overviewExtra.menuAt}: </dt>
          <dd className="inline font-medium break-all">
            <a
              href={menuUrl(restaurant.slug)}
              target="_blank"
              rel="noopener"
              className="text-brand-strong underline underline-offset-2"
            >
              {menuUrl(restaurant.slug).replace(/^https?:\/\//, "")}
            </a>
            {!restaurant.is_published && (
              <span className="text-ink-muted font-normal">
                {" "}
                {t.overviewExtra.notPublished}
              </span>
            )}
          </dd>
          {!isLiveDomain && (
            <p className="text-sm">
              {fill(t.overviewExtra.futureNote, {
                address: `${config.menuBase}${restaurant.slug}`,
              })}
            </p>
          )}
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
          const done = doneSteps[i] ?? false;
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
