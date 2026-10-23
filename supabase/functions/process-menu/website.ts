// Menu import from the restaurant's website (CLAUDE.md 3 owner flow 2, 7). We fetch the page the
// owner gave us; Buddy picks which of its links are the current menu (menu pages, PDFs, images of
// the menu card), and then which PDFs or images those menu pages link to. Everything becomes
// "parts" that are read like photos: long page texts are cut at headings and PDFs split into
// pages, so each model call stays small and they run in parallel inside the time limit.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import type { Anthropic } from "../_shared/claude.ts";
import { splitPdf } from "./pdf.ts";
import {
  countPrices,
  decodeHtml,
  fetchPublic,
  isSocialSite,
  MENU_WORDS,
  pageLinks,
  pageText,
  publicUrl,
  type PageLink,
} from "../_shared/website.ts";

type Block =
  | Anthropic.Beta.BetaImageBlockParam
  | Anthropic.Beta.BetaRequestDocumentBlock
  | Anthropic.Beta.BetaTextBlockParam;

/** One piece read by one model call. */
export interface WebPart {
  kind: "text" | "pdf" | "image";
  /** Where it came from (shown in notes). */
  url: string;
  /** Part n of `of` from the same source (text chunks, PDF pages). */
  n: number;
  of: number;
  block: Block;
}

export type WebsiteError =
  "bad_url" | "social_site" | "site_unreachable" | "no_menu_found";

const USER_AGENT =
  "Mozilla/5.0 (compatible; Brisolo/1.0; menu import for the restaurant owner; +https://brisolo.be)";
const MAX_PARTS = 14;
const MAX_PAGES_FOLLOWED = 4;
const MAX_PDFS = 3;
const MAX_PDF_PAGES = 8;
const MAX_IMAGES = 4;
const CHUNK_CHARS = 2500;
const MAX_TEXT_CHARS = 30_000;
const PDF_BYTES = 10 * 1024 * 1024;
const IMAGE_BYTES = 4_500_000;
const HTML_BYTES = 1_500_000;

const isHtml = (t: string) => t.includes("html");
const isPdf = (t: string) => t.includes("pdf");
const imageType = (t: string) =>
  (["image/jpeg", "image/png", "image/webp", "image/gif"] as const).find((x) =>
    t.startsWith(x),
  );

const pathOf = (u: URL) => {
  let path = u.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep it encoded.
  }
  return path.toLowerCase().replace(/[-_/.]+/g, " ");
};
const looksLikeMenu = (l: PageLink) =>
  MENU_WORDS.test(l.text) || MENU_WORDS.test(pathOf(l.url));
const siteOf = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");
const key = (u: URL) =>
  `${siteOf(u)}${u.pathname.replace(/\/$/, "")}${u.search}`;

/**
 * Cut a page text into pieces of about CHUNK_CHARS, preferably right before a heading, otherwise
 * at a blank line or line break, never inside a line.
 */
export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > size * 1.3) {
    const window = rest.slice(0, size * 1.3);
    const cut = [/\n#{1,6} [^\n]*$/m, /\n\n/, /\n/]
      .map((re) => {
        let best = -1;
        const g = new RegExp(re.source, "gm");
        for (const m of window.matchAll(g))
          if (m.index! >= size * 0.5) best = m.index!;
        return best;
      })
      .find((i) => i > 0);
    const at = cut ?? size;
    chunks.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

const textParts = (url: URL, text: string): WebPart[] => {
  const chunks = chunkText(text);
  return chunks.map((chunk, i) => ({
    kind: "text",
    url: url.href,
    n: i + 1,
    of: chunks.length,
    block: { type: "text", text: chunk },
  }));
};

async function pdfParts(url: URL, bytes: Uint8Array): Promise<WebPart[]> {
  const { pages } = await splitPdf(bytes, MAX_PDF_PAGES);
  return pages.map((page, i) => ({
    kind: "pdf",
    url: url.href,
    n: i + 1,
    of: pages.length,
    block: {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: encodeBase64(page),
      },
    },
  }));
}

function imagePart(
  url: URL,
  bytes: Uint8Array,
  type: NonNullable<ReturnType<typeof imageType>>,
): WebPart {
  return {
    kind: "image",
    url: url.href,
    n: 1,
    of: 1,
    block: {
      type: "image",
      source: { type: "base64", media_type: type, data: encodeBase64(bytes) },
    },
  };
}

const get = (url: URL, maxBytes: number, accept: (t: string) => boolean) =>
  fetchPublic(url, {
    maxBytes,
    timeoutMs: 10_000,
    accept,
    userAgent: USER_AGENT,
  });

/** A link Buddy may follow: a page of the same site, a PDF, or an image. */
export interface Candidate {
  kind: "page" | "pdf" | "image";
  url: URL;
  text: string;
}
/** What Buddy sees of the page the links are on. */
export interface PickContext {
  url: string;
  title: string | null;
  /** The start of the page text. */
  excerpt: string;
}
/**
 * Picks the candidates that are the restaurant's current menu (indexes into the list). Done by
 * the model in pick.ts: link texts alone can't tell a menu photo from a burger photo, or this
 * year's menu from last year's.
 */
export type Pick = (
  candidates: Candidate[],
  context: PickContext,
) => Promise<number[]>;

const MAX_CANDIDATES = { page: 12, pdf: 12, image: 10 } as const;

/** Links on a page that might lead to the menu (not yet seen), for Buddy to pick from. */
function candidatesOn(
  html: string,
  base: URL,
  seen: Set<string>,
  options: { pages: boolean },
): Candidate[] {
  const { links, images } = pageLinks(html, base);
  const out: Candidate[] = [];
  const count = { page: 0, pdf: 0, image: 0 };
  const add = (kind: Candidate["kind"], l: PageLink) => {
    if (count[kind] >= MAX_CANDIDATES[kind] || seen.has(key(l.url))) return;
    seen.add(key(l.url));
    count[kind]++;
    out.push({ kind, url: l.url, text: l.text.slice(0, 120) });
  };
  for (const l of links) {
    if (/\.pdf$/i.test(l.url.pathname)) add("pdf", l);
    else if (/\.(jpe?g|png|webp|gif)$/i.test(l.url.pathname)) {
      if (looksLikeMenu(l)) add("image", l);
    } else if (
      options.pages &&
      siteOf(l.url) === siteOf(base) &&
      looksLikeMenu(l)
    )
      add("page", l);
  }
  for (const l of images)
    if (looksLikeMenu(l) && !/logo|icon|favicon/i.test(l.url.pathname))
      add("image", l);
  return out;
}

/** When the model can't pick: menu pages and menu PDFs by their words, no images. */
const fallbackPick: Pick = (candidates) =>
  Promise.resolve(
    candidates
      .map((c, i) => (c.kind !== "image" && looksLikeMenu(c) ? i : -1))
      .filter((i) => i >= 0),
  );

async function pickSafely(
  pick: Pick,
  candidates: Candidate[],
  context: PickContext,
) {
  if (!candidates.length) return [];
  let chosen: number[];
  try {
    chosen = await pick(candidates, context);
  } catch (e) {
    console.error("pick failed", e instanceof Error ? e.message : e);
    chosen = await fallbackPick(candidates, context);
  }
  return [...new Set(chosen)]
    .filter((i) => i >= 0 && i < candidates.length)
    .map((i) => candidates[i]!);
}

const titleOf = (html: string) =>
  html.match(/<title[^>]*>([^<]{1,200})/i)?.[1]?.trim() ?? null;

/** Everything we found on the website, in reading order, or why there is nothing to read. */
export async function websiteParts(
  raw: string,
  pick: Pick,
): Promise<{ parts: WebPart[] } | { error: WebsiteError }> {
  const start = publicUrl(raw.trim());
  if (!start) return { error: "bad_url" };
  if (isSocialSite(start)) return { error: "social_site" };

  const first = await get(
    start,
    Math.max(HTML_BYTES, PDF_BYTES),
    (t) => isHtml(t) || isPdf(t) || !!imageType(t),
  );
  if (!first) return { error: "site_unreachable" };
  if (isSocialSite(first.url)) return { error: "social_site" };
  if (isPdf(first.contentType))
    return { parts: await pdfParts(first.url, first.bytes) };
  const firstImage = imageType(first.contentType);
  if (firstImage)
    return first.bytes.length <= IMAGE_BYTES
      ? { parts: [imagePart(first.url, first.bytes, firstImage)] }
      : { error: "no_menu_found" };

  const html = decodeHtml(
    first.bytes.subarray(0, HTML_BYTES),
    first.contentType,
  );
  const text = pageText(html);
  // A page with many prices is the menu itself: don't wander off to other pages.
  const isMenuPage = countPrices(text) >= 8;
  const seen = new Set([key(start), key(first.url)]);

  // Round 1: Buddy picks menu pages, PDFs and images among the links on this page.
  const chosen = await pickSafely(
    pick,
    candidatesOn(html, first.url, seen, { pages: !isMenuPage }),
    {
      url: first.url.href,
      title: titleOf(html),
      excerpt: text.slice(0, 1500),
    },
  );
  const pages = chosen
    .filter((c) => c.kind === "page")
    .slice(0, MAX_PAGES_FOLLOWED);
  const files = chosen.filter((c) => c.kind !== "page");

  const texts: { url: URL; text: string }[] = [];
  if (countPrices(text) >= 3) texts.push({ url: first.url, text });
  const followed = (
    await Promise.all(pages.map((c) => get(c.url, HTML_BYTES, isHtml)))
  ).filter((f) => f !== null);
  // Round 2: the menu pages Buddy opened may link to the menu as PDFs or images.
  const more: Candidate[] = [];
  const contexts: PickContext[] = [];
  for (const f of followed) {
    const pageHtml = decodeHtml(f.bytes, f.contentType);
    const t = pageText(pageHtml);
    if (countPrices(t) >= 3) texts.push({ url: f.url, text: t });
    more.push(...candidatesOn(pageHtml, f.url, seen, { pages: false }));
    contexts.push({
      url: f.url.href,
      title: titleOf(pageHtml),
      excerpt: t.slice(0, 600),
    });
  }
  if (more.length)
    files.push(
      ...(await pickSafely(pick, more, {
        url: contexts.map((c) => c.url).join(", "),
        title: contexts[0]?.title ?? null,
        excerpt: contexts
          .map((c) => c.excerpt)
          .join("\n…\n")
          .slice(0, 1500),
      })),
    );

  const pdfLinks = files.filter((c) => c.kind === "pdf").slice(0, MAX_PDFS);
  const imageLinks = files
    .filter((c) => c.kind === "image")
    .slice(0, MAX_IMAGES);
  const [pdfs, pictures] = await Promise.all([
    Promise.all(pdfLinks.map((c) => get(c.url, PDF_BYTES, isPdf))),
    Promise.all(
      imageLinks.map((c) => get(c.url, IMAGE_BYTES, (t) => !!imageType(t))),
    ),
  ]);

  const parts: WebPart[] = [];
  let budget = MAX_TEXT_CHARS;
  for (const t of texts) {
    if (budget <= 0) break;
    parts.push(...textParts(t.url, t.text.slice(0, budget)));
    budget -= t.text.length;
  }
  for (const p of pdfs)
    if (p && !p.truncated) parts.push(...(await pdfParts(p.url, p.bytes)));
  for (const p of pictures) {
    const type =
      p && !p.truncated && p.bytes.length > 20_000
        ? imageType(p.contentType)
        : undefined;
    if (p && type) parts.push(imagePart(p.url, p.bytes, type));
  }
  return parts.length
    ? { parts: parts.slice(0, MAX_PARTS) }
    : { error: "no_menu_found" };
}
