// "Website" on Today: what visitors of brisolo.be click (data-cta buttons, counted by
// track_site_event) next to what they then send (demo requests, "try your menu" runs).
// Visits, pages and countries are in Cloudflare Web Analytics, not here.
import { change, num, useRpc } from "./lib";
import { Card, RankBars, Tile } from "./ui";

interface SiteStats {
  buttons: { label: string; last_30d: number; prev_30d: number }[];
  demo_requests: { last_30d: number; prev_30d: number };
  try_runs: { last_30d: number; prev_30d: number };
}

/** The site's data-cta names, in plain words. */
const buttonNames: Record<string, string> = {
  header: "Book a demo · header",
  hero: "Book a demo · top of the page",
  "hero-demo": "See the demo · top of the page",
  "demo-fullscreen": "Open the demo full screen",
  "try-your-menu": "Try your own menu",
  "try-menu-book-demo": "Book a demo · after trying own menu",
  "menu-demo": "Book a demo · demo page",
  "pricing-small": "Book a demo · Small plan",
  "pricing-medium": "Book a demo · Medium plan",
  "pricing-large": "Book a demo · Large plan",
  final: "Book a demo · bottom of the page",
  footer: "Book a demo · footer",
};
const demoButtons = new Set(["hero-demo", "demo-fullscreen"]);
const tryButtons = new Set(["try-your-menu"]);

export function Website() {
  const { data } = useRpc<SiteStats>("hq_site_stats");
  if (!data) return null;

  const sum = (
    pick: (label: string) => boolean,
    key: "last_30d" | "prev_30d",
  ) =>
    data.buttons.filter((b) => pick(b.label)).reduce((s, b) => s + b[key], 0);
  const isBook = (l: string) => !demoButtons.has(l) && !tryButtons.has(l);
  const book = [sum(isBook, "last_30d"), sum(isBook, "prev_30d")] as const;
  const demo = [
    sum((l) => demoButtons.has(l), "last_30d"),
    sum((l) => demoButtons.has(l), "prev_30d"),
  ] as const;
  const tryClicks = sum((l) => tryButtons.has(l), "last_30d");

  return (
    <section aria-labelledby="website-title">
      <h2 id="website-title" className="text-2xl font-semibold">
        Website{" "}
        <span className="text-ink-muted text-base font-normal">
          · last 30 days
        </span>
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          label="“Book a demo” clicks"
          value={num(book[0])}
          trend={change(book[0], book[1])}
          sub={`${num(data.demo_requests.last_30d)} requests sent`}
        />
        <Tile
          label="Demo opened"
          value={num(demo[0])}
          trend={change(demo[0], demo[1])}
        />
        <Tile
          label="“Try your own menu”"
          value={num(tryClicks)}
          sub={`${num(data.try_runs.last_30d)} menus translated`}
        />
      </div>
      <div className="mt-3">
        <Card
          title="Where visitors click"
          action={
            <span className="text-ink-muted text-sm">
              visits: Cloudflare Web Analytics
            </span>
          }
        >
          <RankBars
            rows={data.buttons
              .filter((b) => b.last_30d > 0)
              .map((b) => ({
                key: b.label,
                label: buttonNames[b.label] ?? b.label,
                value: b.last_30d,
              }))}
            empty="No clicks yet"
          />
        </Card>
      </div>
    </section>
  );
}
