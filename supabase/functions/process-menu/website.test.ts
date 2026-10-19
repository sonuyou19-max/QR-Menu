// deno test --allow-net=registry.npmjs.org supabase/functions/process-menu/website.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { countPrices, pageLinks, pageText } from "../_shared/website.ts";
import { chunkText, websiteParts, type Pick } from "./website.ts";

/** Stands in for Buddy: picks what a person would (menu words, no food photos, no vacancies). */
const pickMenu: Pick = (candidates) =>
  Promise.resolve(
    candidates
      .map((c, i) =>
        /menu|kaart/i.test(`${c.text} ${c.url.pathname}`) &&
        !/vacature/i.test(c.text)
          ? i
          : -1,
      )
      .filter((i) => i >= 0),
  );

const home = `<!doctype html><html><head><title>Lindehof</title><script>var x = "€ 99,00";</script></head>
<body><nav><a href="/">Home</a><a href="/menukaart">Menukaart</a><a href="/contact">Contact</a>
<a href="https://www.instagram.com/lindehof">Instagram</a></nav>
<main><h1>Brasserie Lindehof</h1><p>Welkom in hartje Leuven &amp; omstreken.</p>
<img src="/img/logo.png" alt="logo"></main><footer>Open di–zo</footer></body></html>`;

const menuPage = `<html><body><main>
<h2>Voorgerechten</h2><ul>
<li><strong>Kaaskroketten</strong> <span>twee stuks, peterselie</span> <em>€&nbsp;14,50</em></li>
<li><strong>Garnaalkroketten</strong> <em>€ 18,50</em></li></ul>
<h2>Hoofdgerechten</h2><table><tr><td>Stoofvlees met frietjes</td><td>22,50</td></tr>
<tr><td>Waterzooi van kip</td><td>21,00</td></tr></table>
<p><a href="/files/wijnkaart.pdf">Onze wijnkaart (PDF)</a> <a href="/files/vacature.pdf">Vacature</a></p>
<img data-src="https://cdn.example.net/u/menu-dessertkaart.jpg" alt="Dessertkaart">
</main></body></html>`;

async function twoPagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.addPage();
  return await doc.save();
}

function stubFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const original = globalThis.fetch;
  const asked: string[] = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    asked.push(url);
    const route = routes[url];
    return Promise.resolve(
      route ? route() : new Response("nope", { status: 404 }),
    );
  }) as typeof fetch;
  return { asked, restore: () => (globalThis.fetch = original) };
}
const html = (body: string) =>
  new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

Deno.test("pageText keeps structure and drops scripts, nav and footer", () => {
  const t = pageText(menuPage);
  assert(t.includes("## Voorgerechten"));
  assert(t.includes("- Kaaskroketten twee stuks, peterselie € 14,50"));
  assert(t.includes("Stoofvlees met frietjes | 22,50 |"));
  const h = pageText(home);
  assert(!h.includes("99,00"));
  assert(!h.includes("Menukaart"));
  assert(!h.includes("Open di"));
  assert(h.includes("hartje Leuven & omstreken"));
});

Deno.test("countPrices", () => {
  assertEquals(countPrices(pageText(menuPage)), 4);
  assertEquals(countPrices("Open 12:00 tot 22:00, sinds 1998"), 0);
});

Deno.test("pageLinks resolves links and lazy images", () => {
  const { links, images } = pageLinks(
    menuPage,
    new URL("https://lindehof.be/menukaart"),
  );
  assertEquals(
    links.map((l) => l.url.href),
    [
      "https://lindehof.be/files/wijnkaart.pdf",
      "https://lindehof.be/files/vacature.pdf",
    ],
  );
  assertEquals(
    images[0]!.url.href,
    "https://cdn.example.net/u/menu-dessertkaart.jpg",
  );
  assertEquals(images[0]!.text, "Dessertkaart");
});

Deno.test("chunkText cuts before headings, never inside a line", () => {
  const section = (n: number) =>
    `## Categorie ${n}\n` +
    Array.from(
      { length: 30 },
      (_, i) => `- Gerecht ${n}.${i} met saus € 12,50`,
    ).join("\n");
  const text = [1, 2, 3, 4].map(section).join("\n\n");
  const chunks = chunkText(text, 1500);
  assert(chunks.length >= 2);
  assertEquals(
    chunks.join("\n").replace(/\s+/g, " "),
    text.replace(/\s+/g, " "),
  );
  for (const c of chunks.slice(1))
    assert(c.startsWith("## Categorie") || c.startsWith("- Gerecht"));
  assert(chunks.every((c) => c.length <= 1500 * 1.3));
});

Deno.test(
  "websiteParts follows the menu link, its menu PDF and menu image",
  async () => {
    const pdf = await twoPagePdf();
    const jpeg = new Uint8Array(30_000);
    const s = stubFetch({
      "https://lindehof.be/": () => html(home),
      "https://lindehof.be/menukaart": () => html(menuPage),
      "https://lindehof.be/files/wijnkaart.pdf": () =>
        new Response(new Uint8Array(pdf), {
          headers: { "content-type": "application/pdf" },
        }),
      "https://cdn.example.net/u/menu-dessertkaart.jpg": () =>
        new Response(jpeg, { headers: { "content-type": "image/jpeg" } }),
    });
    try {
      const found = await websiteParts("lindehof.be", pickMenu);
      assert("parts" in found);
      assertEquals(
        found.parts.map((p) => `${p.kind} ${p.url} ${p.n}/${p.of}`),
        [
          "text https://lindehof.be/menukaart 1/1",
          "pdf https://lindehof.be/files/wijnkaart.pdf 1/2",
          "pdf https://lindehof.be/files/wijnkaart.pdf 2/2",
          "image https://cdn.example.net/u/menu-dessertkaart.jpg 1/1",
        ],
      );
      assert(
        !s.asked.some(
          (u) =>
            u.includes("contact") ||
            u.includes("instagram") ||
            u.includes("vacature"),
        ),
      );
    } finally {
      s.restore();
    }
  },
);

Deno.test(
  "websiteParts: a menu page is read as is, redirects are followed",
  async () => {
    const s = stubFetch({
      "https://lindehof.be/kaart": () =>
        new Response(null, {
          status: 301,
          headers: { location: "/menukaart" },
        }),
      "https://lindehof.be/menukaart": () =>
        html(
          menuPage.replace(
            "</main>",
            "<p>Mosselen € 28,00 · Frieten € 4,50 · Dame blanche € 9,00 · Mousse € 8,50</p></main>",
          ),
        ),
    });
    try {
      const found = await websiteParts("https://lindehof.be/kaart", pickMenu);
      assert("parts" in found);
      assertEquals(found.parts[0]!.kind, "text");
      assertEquals(found.parts[0]!.url, "https://lindehof.be/menukaart");
    } finally {
      s.restore();
    }
  },
);

Deno.test("websiteParts errors", async () => {
  const s = stubFetch({
    "https://empty.be/": () =>
      html("<html><body><div id=root></div></body></html>"),
  });
  try {
    assertEquals(await websiteParts("not a url", pickMenu), {
      error: "bad_url",
    });
    assertEquals(await websiteParts("http://localhost/menu", pickMenu), {
      error: "bad_url",
    });
    assertEquals(
      await websiteParts("https://www.instagram.com/lindehof/", pickMenu),
      { error: "social_site" },
    );
    assertEquals(await websiteParts("https://down.be", pickMenu), {
      error: "site_unreachable",
    });
    assertEquals(await websiteParts("empty.be", pickMenu), {
      error: "no_menu_found",
    });
  } finally {
    s.restore();
  }
});

Deno.test(
  "websiteParts: when Buddy can't pick, menu pages and PDFs by their words, no images",
  async () => {
    const s = stubFetch({
      "https://lindehof.be/": () => html(home),
      "https://lindehof.be/menukaart": () => html(menuPage),
      "https://lindehof.be/files/wijnkaart.pdf": async () =>
        new Response(new Uint8Array(await twoPagePdf()), {
          headers: { "content-type": "application/pdf" },
        }),
    });
    try {
      const found = await websiteParts("lindehof.be", () =>
        Promise.reject(new Error("API down")),
      );
      assert("parts" in found);
      assertEquals(
        found.parts.map((p) => p.kind),
        ["text", "pdf", "pdf"],
      );
    } finally {
      s.restore();
    }
  },
);
