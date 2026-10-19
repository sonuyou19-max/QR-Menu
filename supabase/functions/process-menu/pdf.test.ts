// deno test --allow-net=registry.npmjs.org supabase/functions/process-menu/pdf.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { splitPdf } from "./pdf.ts";

async function pdfWith(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return await doc.save();
}

Deno.test(
  "splits into single pages, at most max, and reports the total",
  async () => {
    const result = await splitPdf(await pdfWith(10), 8);
    assertEquals(
      [result.pages.length, result.total, result.locked],
      [8, 10, false],
    );
    const first = await PDFDocument.load(result.pages[0]!);
    assertEquals(first.getPageCount(), 1);
  },
);

Deno.test("a one-page PDF is sent as it is", async () => {
  const bytes = await pdfWith(1);
  const result = await splitPdf(bytes, 8);
  assertEquals(result.pages, [bytes]);
});

Deno.test("a file pdf-lib can't parse is sent whole", async () => {
  const bytes = new TextEncoder().encode("%PDF-1.4 not really");
  const result = await splitPdf(bytes, 8);
  assertEquals([result.pages.length, result.locked], [1, false]);
});
