// Phone-preview only (see phone-preview.mjs): mounts the React islands without Astro's
// chunked loader, so the whole preview can live in one HTML file.
import { createRoot } from "react-dom/client";
import DemoPhone from "../src/components/demo/DemoPhone";

const components = { DemoPhone } as const;

for (const island of document.querySelectorAll("astro-island")) {
  const { name } = JSON.parse(island.getAttribute("opts") ?? "{}") as {
    name?: string;
  };
  const Component = components[name as keyof typeof components];
  if (!Component) continue;
  // Astro serialises each prop as [type, value]; the demo only uses plain values (type 0).
  const raw = JSON.parse(island.getAttribute("props") ?? "{}") as Record<
    string,
    [number, unknown]
  >;
  const props = Object.fromEntries(
    Object.entries(raw).map(([k, [, v]]) => [k, v]),
  );
  createRoot(island).render(<Component {...(props as { label: string })} />);
}
