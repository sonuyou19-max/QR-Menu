import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useI18n } from "../i18n";

/** Full-screen loading state; with `error`, a retry message instead. */
export function FullPageSpinner({
  error = false,
  onRetry,
}: {
  error?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  if (error) {
    return (
      <div
        role="alert"
        className="grid min-h-dvh place-items-center px-4 text-center"
      >
        <div className="space-y-4">
          <TriangleAlert
            className="text-danger mx-auto size-8"
            aria-hidden="true"
          />
          <p className="text-lg">{t.loadError}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-secondary">
              {t.retry}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="text-ink-muted grid min-h-dvh place-items-center"
    >
      <span className="flex items-center gap-2">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        {t.loading}
      </span>
    </div>
  );
}
