import mark from "@menubuddy/design-tokens/assets/logo-mark.svg?raw";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="size-9 [&>svg]:size-full"
        dangerouslySetInnerHTML={{ __html: mark }}
        aria-hidden="true"
      />
      <span
        className={`font-display text-xl font-semibold tracking-tight ${compact ? "max-[379px]:sr-only" : ""}`}
      >
        Brisolo
      </span>
    </span>
  );
}
