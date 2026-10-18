import { LoaderCircle } from "lucide-react";
import { useI18n } from "../i18n";

export function FullPageSpinner() {
  const { t } = useI18n();
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
