// Fetching a restaurant's own website server-side (look suggestion, menu import). Public hosts
// only, redirects followed by hand (each hop checked again), short timeouts, size limits.

export function publicUrl(raw: string, base?: URL): URL | null {
  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(raw) || base ? raw : `https://${raw}`,
      base,
    );
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.port ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    host.startsWith("[") ||
    /(^|\.)(localhost|local|internal|lan|home|arpa)$/.test(host)
  )
    return null;
  url.hash = "";
  return url;
}

/** Social sites need a login or render with scripts: we can't read a menu there. */
export function isSocialSite(url: URL): boolean {
  return /(^|\.)(instagram\.com|facebook\.com|fb\.com|tiktok\.com|x\.com|twitter\.com|linktr\.ee)$/.test(
    url.hostname.toLowerCase(),
  );
}

export interface Fetched {
  url: URL;
  contentType: string;
  bytes: Uint8Array;
  /** Cut off at maxBytes. */
  truncated: boolean;
}

/** GET a public URL. Null when it can't be fetched, isn't OK, or isn't one of the accepted types. */
export async function fetchPublic(
  start: URL,
  options: {
    maxBytes: number;
    timeoutMs: number;
    accept: (contentType: string) => boolean;
    userAgent: string;
  },
): Promise<Fetched | null> {
  let url: URL | null = start;
  try {
    for (let hop = 0; url && hop < 5; hop++) {
      const res: Response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: {
          "User-Agent": options.userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/pdf,image/*;q=0.8,*/*;q=0.5",
          "Accept-Language": "nl,fr;q=0.9,en;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        await res.body?.cancel();
        url = next ? publicUrl(next, url) : null;
        continue;
      }
      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!res.ok || !res.body || !options.accept(contentType)) {
        await res.body?.cancel();
        return null;
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      let truncated = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
        if (size >= options.maxBytes) {
          truncated = true;
          break;
        }
      }
      await reader.cancel().catch(() => {});
      const bytes = new Uint8Array(Math.min(size, options.maxBytes));
      let at = 0;
      for (const c of chunks) {
        const part = c.subarray(0, bytes.length - at);
        bytes.set(part, at);
        at += part.length;
        if (at >= bytes.length) break;
      }
      return { url, contentType, bytes, truncated };
    }
  } catch (e) {
    console.error(
      "fetch failed",
      start.href,
      e instanceof Error ? e.message : e,
    );
  }
  return null;
}

export function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const charset =
    contentType.match(/charset=([\w-]+)/)?.[1] ??
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  euro: "€",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  auml: "ä",
  ccedil: "ç",
  ocirc: "ô",
  ouml: "ö",
  uuml: "ü",
  ucirc: "û",
  iuml: "ï",
  icirc: "î",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  deg: "°",
  times: "×",
};
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : m;
    }
    return entities[e.toLowerCase()] ?? m;
  });
}

/**
 * The page's visible text, keeping its structure (headings, list items, table rows and line breaks
 * on their own lines) so the model can tell categories, dishes, descriptions and prices apart.
 */
export function pageText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(
        /<(script|style|noscript|svg|template|iframe|form|select)\b[\s\S]*?<\/\1>/gi,
        " ",
      )
      .replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<h([1-6])\b[^>]*>/gi, (_, n) => `\n\n${"#".repeat(Number(n))} `)
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/(td|th)>/gi, " | ")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(
        /<\/?(p|div|section|article|tr|ul|ol|dl|dt|dd|table|header|main|aside|figure|figcaption|blockquote)\b[^>]*>/gi,
        "\n",
      )
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/(\n- ?)+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface PageLink {
  url: URL;
  text: string;
}

/** Links on the page (anchors) and images, resolved against the page address. */
export function pageLinks(
  html: string,
  base: URL,
): { links: PageLink[]; images: PageLink[] } {
  const baseHref = html.match(/<base\b[^>]*href=["']([^"']+)["']/i)?.[1];
  const resolveBase = (baseHref && publicUrl(baseHref, base)) || base;
  const clean = (s: string) =>
    decodeEntities(s.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  const links: PageLink[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]{0,600}?)<\/a>/gi)) {
    const attrs = m[1]!;
    const href = attrs.match(/href=["']([^"'#][^"']*)["']/i)?.[1];
    if (!href || /^(mailto|tel|javascript):/i.test(href)) continue;
    const url = publicUrl(decodeEntities(href), resolveBase);
    if (!url) continue;
    const title =
      attrs.match(/(?:title|aria-label)=["']([^"']+)["']/i)?.[1] ?? "";
    const alt = m[2]!.match(/alt=["']([^"']+)["']/i)?.[1] ?? "";
    links.push({ url, text: clean(`${m[2]} ${title} ${alt}`) });
  }
  const images: PageLink[] = [];
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = m[1]!;
    const src =
      attrs.match(/data-(?:src|lazy-src|original)=["']([^"']+)["']/i)?.[1] ??
      attrs.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (!src || src.startsWith("data:")) continue;
    const url = publicUrl(decodeEntities(src), resolveBase);
    if (!url) continue;
    const alt = attrs.match(/(?:alt|title)=["']([^"']*)["']/i)?.[1] ?? "";
    images.push({ url, text: clean(alt) });
  }
  return { links, images };
}

/**
 * Words that mark a link, file or image as (part of) the menu, in the languages we see in Belgium.
 * Dutch and German compounds count too: wijnkaart, dessertkaart, Getränkekarte.
 */
export const MENU_WORDS =
  /(\bmenu|kaart\b|karte\b|\bcarte\b|\bla-?carte|\bfood\b|\beten\b|\bgerechten\b|\bplats\b|\blunch|\bdiner\b|\bdinner\b|\bbrunch\b|\bontbijt\b|\bbreakfast\b|\bpetit-?d[ée]jeuner\b|\bdranken\b|\bdrinks?\b|\bboissons?\b|\bgetr[äa]nke|\bwijn|\bwines?\b|\bvins?\b|\bbier|\bbeers?\b|\bbi[èe]res?\b|\bdesserts?\b|\bsuggesties\b|\bsuggestions\b|\bdagschotel|\bplat-?du-?jour|\btake-?away\b|\bafhaal)/i;

/** Euro amounts in a text: how "menu-like" a page is. */
export function countPrices(text: string): number {
  return (
    text.match(
      /(?:€\s?\d{1,3}(?:[.,]\d{1,2})?)|(?:\b\d{1,3}[.,]\d{2}\s?(?:€|eur\b|euro))|(?:\b\d{1,3}[.,]\d{2}\b)/gi,
    )?.length ?? 0
  );
}
