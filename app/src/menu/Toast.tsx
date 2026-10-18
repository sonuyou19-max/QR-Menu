import { useEffect, useState } from "react";
import { CircleCheck, TriangleAlert, X } from "lucide-react";
import { useI18n } from "../i18n";
import type { Toast as ToastData } from "./useMenuEditor";

const VISIBLE_MS = 5000;

/** "Saved · Undo" message at the bottom; disappears after ~5 seconds. */
export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData | null;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const [undoing, setUndoing] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setUndoing(false);
    const timer = setTimeout(onDismiss, VISIBLE_MS + (toast.error ? 2000 : 0));
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {toast && (
        <div
          key={toast.id}
          className="bg-ink text-canvas rounded-card pointer-events-auto flex max-w-md min-w-0 flex-1 items-center gap-3 py-2 pr-2 pl-4 shadow-lg"
        >
          {toast.error ? (
            <TriangleAlert
              className="text-paprika-300 size-5 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <CircleCheck
              className="text-herb-300 size-5 shrink-0"
              aria-hidden="true"
            />
          )}
          <p className="min-w-0 flex-1 truncate font-medium">{toast.message}</p>
          {toast.undo && (
            <button
              type="button"
              disabled={undoing}
              onClick={() => {
                setUndoing(true);
                void toast.undo?.();
              }}
              className="text-mustard-300 min-h-11 shrink-0 rounded-full px-3 font-semibold underline-offset-2 hover:underline"
            >
              {t.editor.toast.undo}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="grid size-11 shrink-0 place-items-center rounded-full"
            aria-label={t.editor.toast.close}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
