import { useState } from "react";
import { ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { fill, useI18n } from "../i18n";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

/**
 * Restaurant-wide "show allergens to guests" switch. Turning it on asks to confirm the dishes that
 * were never confirmed; earlier confirmations are kept per dish, so they are not asked again.
 */
export function AllergenSwitch({
  pendingCount,
  onStartConfirming,
}: {
  pendingCount: number;
  onStartConfirming: () => void;
}) {
  const { t } = useI18n();
  const { restaurant, reload } = useRestaurant();
  // Shown at once; the saved value takes over after the reload.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const on = optimistic ?? restaurant.show_allergens;

  const toggle = async (next: boolean) => {
    setOptimistic(next);
    setFailed(false);
    const { error } = await supabase
      .from("restaurants")
      .update({ show_allergens: next })
      .eq("id", restaurant.id);
    if (error) setFailed(true);
    else await reload();
    setOptimistic(null);
  };

  const s = t.editor.allergenSwitch;
  const tone = !on
    ? "bg-oat-100"
    : pendingCount > 0
      ? "bg-mustard-50"
      : "bg-herb-50";

  return (
    <section
      className={`rounded-card mt-5 p-4 ${tone}`}
      aria-labelledby="allergen-switch"
    >
      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
        <span>
          <span id="allergen-switch" className="block font-semibold">
            {s.title}
          </span>
          <span className="text-ink-muted block text-sm">{s.label}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={on}
          onChange={(e) => void toggle(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="bg-oat-300 peer-checked:bg-herb-600 peer-focus-visible:outline-brand relative h-8 w-14 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-6"
        />
      </label>

      <div aria-live="polite" className="mt-2 text-sm">
        {failed ? (
          <p role="alert" className="text-danger font-medium">
            {t.editor.toast.error}
          </p>
        ) : !on ? (
          <p className="text-ink-muted flex gap-2">
            <ShieldOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {s.offText}
          </p>
        ) : pendingCount > 0 ? (
          <div>
            <p className="text-mustard-900 flex gap-2">
              <ShieldAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {pendingCount === 1
                ? s.pendingOne
                : fill(s.pending, { count: pendingCount })}
            </p>
            <button
              type="button"
              onClick={onStartConfirming}
              className="btn-primary mt-3 w-full sm:w-auto"
            >
              <ShieldCheck className="size-5" aria-hidden="true" />
              {s.start}
            </button>
          </div>
        ) : (
          <p className="text-herb-800 flex gap-2">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {s.allConfirmed}
          </p>
        )}
      </div>
    </section>
  );
}
