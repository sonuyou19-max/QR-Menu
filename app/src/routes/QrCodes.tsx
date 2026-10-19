import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  Download,
  ExternalLink,
  Maximize2,
  Printer,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import { fill, useI18n, type Dictionary } from "../i18n";
import { config, isLiveDomain, menuUrl } from "../lib/config";
import { QrCode, qrPng } from "../lib/qr";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";

const MAX_TABLES = 100;
/** Same rule as the guest page (?t=) and the database check. */
const LABEL = /^[\p{L}\p{N} _-]{1,20}$/u;

function tableUrl(slug: string, table: string | null): string {
  return table
    ? `${menuUrl(slug)}?t=${encodeURIComponent(table)}`
    : menuUrl(slug);
}

/** "5" → "Table 5"; a name the owner typed ("Terrace 2") stays as it is. */
function tableCaption(q: Dictionary["qr"], table: string): string {
  return /^\d+$/.test(table) ? fill(q.tableCaption, { table }) : table;
}

/** Restaurant code first, then the table codes in number order where they are numbers. */
function sortTables(tables: string[]): string[] {
  return [...tables].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

async function sharePng(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  // On phones the share sheet offers "Save image"; elsewhere a normal download.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** QR codes (CLAUDE.md 3 owner flow 8, 10 step 7b): one per restaurant, optional per table. */
export function QrCodes() {
  const { t } = useI18n();
  const q = t.qr;
  const { restaurant, reload } = useRestaurant();
  const slug = restaurant.slug;
  const [tables, setTables] = useState<string[]>(restaurant.qr_tables);
  const [saveError, setSaveError] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [rangeTo, setRangeTo] = useState("");
  const [large, setLarge] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setTables(restaurant.qr_tables), [restaurant.qr_tables]);

  const save = async (next: string[]) => {
    const previous = tables;
    const sorted = sortTables(next);
    setTables(sorted);
    setSaveError(false);
    const { error } = await supabase
      .from("restaurants")
      .update({ qr_tables: sorted })
      .eq("id", restaurant.id);
    if (error) {
      setTables(previous);
      setSaveError(true);
    } else {
      await reload();
    }
  };

  const addOne = (e: FormEvent) => {
    e.preventDefault();
    const label = name.trim().replace(/\s+/g, " ");
    if (!LABEL.test(label)) return setNameError(q.invalid);
    if (tables.some((x) => x.toLowerCase() === label.toLowerCase()))
      return setNameError(q.duplicate);
    if (tables.length >= MAX_TABLES) return setNameError(q.tooMany);
    setNameError(null);
    setName("");
    void save([...tables, label]);
  };

  const addRange = (e: FormEvent) => {
    e.preventDefault();
    const to = Math.min(Number(rangeTo), MAX_TABLES);
    if (!Number.isInteger(to) || to < 1) return;
    const numbers = Array.from({ length: to }, (_, i) => String(i + 1));
    const next = [...tables, ...numbers.filter((n) => !tables.includes(n))];
    if (next.length > MAX_TABLES) return setNameError(q.tooMany);
    setNameError(null);
    setRangeTo("");
    void save(next);
  };

  const shareLink = async () => {
    const url = menuUrl(slug);
    if (navigator.share) {
      try {
        await navigator.share({ title: restaurant.name, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // No share and no clipboard: the address is shown on screen anyway.
    }
  };

  const download = async (table: string | null) => {
    const blob = await qrPng(
      tableUrl(slug, table),
      restaurant.name,
      table && tableCaption(q, table),
    );
    await sharePng(
      blob,
      `menu-qr-${slug}${table ? `-${table.replace(/\s+/g, "-")}` : ""}.png`,
    );
  };

  const address = menuUrl(slug).replace(/^https?:\/\//, "");
  const langs = restaurant.guest_languages.map((l) => l.toUpperCase()).join(" · ");

  return (
    <div>
      <div className="print:hidden">
        <h1 className="text-3xl font-semibold sm:text-4xl">{q.title}</h1>
        <p className="text-ink-muted mt-2 text-lg">{q.intro}</p>

        {!restaurant.is_published && (
          <p
            role="status"
            className="bg-mustard-100 text-mustard-900 rounded-card mt-5 flex gap-2 p-4 font-medium"
          >
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>
              {q.notPublished}{" "}
              <Link to="/menu" className="underline underline-offset-2">
                {q.toMenu}
              </Link>
            </span>
          </p>
        )}

        <section
          aria-labelledby="qr-main"
          className="rounded-card bg-surface shadow-card mt-6 p-5"
        >
          <h2 id="qr-main" className="text-xl font-semibold">
            {q.mainTitle}
          </h2>
          <p className="text-ink-muted mt-1">{q.mainHint}</p>
          <div className="mt-4 flex flex-col items-center">
            <QrCode
              value={menuUrl(slug)}
              label={fill(q.codeLabel, { target: restaurant.name })}
              className="size-64 rounded-xl sm:size-72"
            />
            {!isLiveDomain && (
              <span className="bg-mustard-500 mt-2 rounded-full px-3 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
                {q.testBadge}
              </span>
            )}
            <p className="text-ink-muted mt-3 text-center text-sm break-all">
              {address}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a
                href={menuUrl(slug)}
                target="_blank"
                rel="noopener"
                className="btn-primary"
              >
                <ExternalLink className="size-5" aria-hidden="true" />
                {q.open}
              </a>
              <button
                type="button"
                onClick={() => void shareLink()}
                className="btn-secondary"
              >
                <Send className="size-5" aria-hidden="true" />
                {copied ? q.copied : q.share}
              </button>
              {isLiveDomain && (
                <button
                  type="button"
                  onClick={() => void download(null)}
                  className="btn-secondary"
                >
                  <Download className="size-5" aria-hidden="true" />
                  {q.download}
                </button>
              )}
            </div>
          </div>
        </section>

        {!isLiveDomain && (
          <div className="border-mustard-500 bg-mustard-50 rounded-card mt-4 border-2 border-dashed p-4">
            <p className="text-mustard-900 flex items-center gap-2 font-bold">
              <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
              {q.testTitle}
            </p>
            <p className="text-ink-muted mt-1">
              {fill(q.testText, { address: `${config.menuBase}${slug}` })}
            </p>
          </div>
        )}

        <section
          aria-labelledby="qr-tables"
          className="rounded-card bg-surface shadow-card mt-6 p-5"
        >
          <h2 id="qr-tables" className="text-xl font-semibold">
            {q.tablesTitle}
          </h2>
          <p className="text-ink-muted mt-1">{q.tablesHint}</p>

          <form onSubmit={addOne} className="mt-4">
            <label htmlFor="table-name" className="font-semibold">
              {q.tableName}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="table-name"
                className="input"
                value={name}
                maxLength={20}
                placeholder={q.tableNamePlaceholder}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "table-error" : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
              />
              <button type="submit" className="btn-primary shrink-0">
                {q.add}
              </button>
            </div>
          </form>
          <form onSubmit={addRange} className="mt-3 flex items-center gap-2">
            <label htmlFor="table-range" className="text-ink-muted">
              {q.addRange}
            </label>
            <input
              id="table-range"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_TABLES}
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="input w-20 px-2 text-center"
            />
            <button type="submit" className="btn-secondary shrink-0">
              {q.add}
            </button>
          </form>
          {nameError && (
            <p id="table-error" role="alert" className="text-danger mt-2 font-medium">
              {nameError}
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-danger mt-2 font-medium">
              {q.saveError}
            </p>
          )}

          {tables.length === 0 ? (
            <p className="text-ink-muted bg-oat-50 rounded-control mt-5 p-4 text-center">
              {q.empty}
            </p>
          ) : (
            <>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tables.map((table) => (
                  <li
                    key={table}
                    className="border-line rounded-control relative border p-3"
                  >
                    <button
                      type="button"
                      onClick={() => setLarge(table)}
                      className="block w-full"
                      aria-label={fill(q.enlarge, {
                        table: tableCaption(q, table),
                      })}
                    >
                      <QrCode
                        value={tableUrl(slug, table)}
                        label=""
                        className="w-full"
                      />
                      <span className="mt-1 flex items-center justify-center gap-1 font-semibold">
                        {tableCaption(q, table)}
                        <Maximize2
                          className="text-ink-muted size-3.5"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void save(tables.filter((x) => x !== table))}
                      className="bg-surface border-line absolute -top-2 -right-2 grid size-9 place-items-center rounded-full border shadow-sm"
                      aria-label={fill(q.remove, {
                        table: tableCaption(q, table),
                      })}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(q.removeAllConfirm)) void save([]);
                }}
                className="text-ink-muted mt-4 min-h-11 font-medium underline underline-offset-2"
              >
                {q.removeAll}
              </button>
            </>
          )}
        </section>

        {isLiveDomain ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-primary w-full sm:w-auto"
            >
              <Printer className="size-5" aria-hidden="true" />
              {tables.length > 0 ? q.printAll : q.print}
            </button>
            <p className="text-ink-muted mt-2 text-sm">{q.printHint}</p>
          </div>
        ) : (
          <p className="text-ink-muted mt-6">{q.printLater}</p>
        )}
      </div>

      {/* Only the real codes can be printed: never a test address on a table. */}
      {isLiveDomain && (
        <div className="hidden grid-cols-2 gap-[8mm] print:grid">
          {[null, ...tables].map((table) => (
            <div
              key={table ?? ""}
              className="flex break-inside-avoid flex-col items-center rounded-[4mm] border border-black p-[6mm] text-center text-black"
            >
              <p className="font-display text-[16pt] font-semibold">
                {restaurant.name}
              </p>
              <QrCode
                value={tableUrl(slug, table)}
                label=""
                className="mt-[3mm] w-[55mm]"
              />
              <p className="mt-[2mm] text-[11pt]">Menu · {langs}</p>
              {table && (
                <p className="mt-[1mm] text-[18pt] font-bold">
                  {tableCaption(q, table)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {large && (
        <LargeCode
          value={tableUrl(slug, large)}
          caption={tableCaption(q, large)}
          q={q}
          onDownload={isLiveDomain ? () => void download(large) : null}
          onClose={() => setLarge(null)}
        />
      )}
    </div>
  );
}

/** One table code full size, to scan from another phone. */
function LargeCode({
  value,
  caption,
  q,
  onDownload,
  onClose,
}: {
  value: string;
  caption: string;
  q: Dictionary["qr"];
  onDownload: (() => void) | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="large-code"
      className="bg-canvas text-ink m-auto w-[min(26rem,calc(100%-2rem))] rounded-[1.5rem] p-5 shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="large-code" className="text-2xl font-semibold">
          {caption}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="bg-surface border-line grid size-11 place-items-center rounded-full border"
          aria-label={q.close}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {!isLiveDomain && (
        <p className="text-mustard-900 mt-2 text-sm font-bold uppercase">
          {q.testBadge}
        </p>
      )}
      <QrCode
        value={value}
        label={fill(q.codeLabel, { target: caption })}
        className="mt-3 w-full rounded-xl"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={value} target="_blank" rel="noopener" className="btn-secondary">
          <ExternalLink className="size-5" aria-hidden="true" />
          {q.open}
        </a>
        {onDownload && (
          <button type="button" onClick={onDownload} className="btn-secondary">
            <Download className="size-5" aria-hidden="true" />
            {q.download}
          </button>
        )}
      </div>
    </dialog>
  );
}
