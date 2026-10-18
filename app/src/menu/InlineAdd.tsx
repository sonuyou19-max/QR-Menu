import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "../i18n";

/** "+ Add dish" / "+ Add category": a button that turns into a name field. */
export function InlineAdd({
  label,
  placeholder,
  onAdd,
  large = false,
}: {
  label: string;
  placeholder: string;
  onAdd: (name: string) => Promise<void> | void;
  large?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-brand-strong inline-flex min-h-11 items-center gap-1.5 font-semibold ${large ? "text-lg" : ""}`}
      >
        <Plus className="size-5" aria-hidden="true" />
        {label}
      </button>
    );

  const submit = async () => {
    const value = name.trim();
    if (!value) return setOpen(false);
    setBusy(true);
    await onAdd(value);
    setBusy(false);
    setName("");
    setOpen(false);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-wrap items-center gap-2 py-2"
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder={placeholder}
        maxLength={large ? 120 : 200}
        className="input min-w-0 flex-1 basis-56"
      />
      <button type="submit" disabled={busy} className="btn-primary">
        {t.editor.add}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="btn-secondary"
      >
        {t.editor.cancel}
      </button>
    </form>
  );
}
