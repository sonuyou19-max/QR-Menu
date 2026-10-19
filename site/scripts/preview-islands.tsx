// Phone-preview only (see phone-preview.mjs): mounts the React islands without Astro's
// chunked loader, so the whole preview can live in one HTML file.
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import BookDemoForm from "../src/components/forms/BookDemoForm";
import TryYourMenu from "../src/components/forms/TryYourMenu";

// The preview page can't reach the network, so the form only validates and shows its success state.
const components: Record<
  string,
  { Component: ComponentType<any>; extra?: object }
> = {
  BookDemoForm: { Component: BookDemoForm, extra: { previewMode: true } },
  TryYourMenu: { Component: TryYourMenu, extra: { previewMode: true } },
};

/** Astro serialises props as [type, value]: 0 = plain value or object, 1 = array. */
function revive([type, value]: [number, unknown]): unknown {
  if (type === 1) return (value as [number, unknown][]).map(revive);
  if (type === 0 && value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, [number, unknown]>).map(
        ([k, v]) => [k, revive(v)],
      ),
    );
  }
  return value;
}

let index = 0;
for (const island of document.querySelectorAll("astro-island")) {
  const { name } = JSON.parse(island.getAttribute("opts") ?? "{}") as {
    name?: string;
  };
  const entry = components[name ?? ""];
  if (!entry) continue;
  const props = revive([
    0,
    JSON.parse(island.getAttribute("props") ?? "{}"),
  ]) as object;
  // useId() values repeat across roots unless each root gets its own prefix.
  createRoot(island, {
    identifierPrefix: `${island.getAttribute("prefix") ?? "i"}-${index++}-`,
  }).render(<entry.Component {...props} {...entry.extra} />);
}
