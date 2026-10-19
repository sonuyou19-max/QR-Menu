// PDF menus (uploaded, or linked on the restaurant's website): split into single-page PDFs so the
// pages are read in parallel like photos and each model call stays small.
import { PDFDocument } from "npm:pdf-lib@1.17.1";

export interface SplitPdf {
  /** Single-page PDFs, at most `max`. */
  pages: Uint8Array[];
  /** Pages in the whole file. */
  total: number;
  /** Password-protected: we can't read it, and neither can the model. */
  locked: boolean;
}

export async function splitPdf(
  bytes: Uint8Array,
  max: number,
): Promise<SplitPdf> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = doc.getPageCount();
    if (doc.isEncrypted) return { pages: [], total, locked: true };
    if (total <= 1) return { pages: [bytes], total, locked: false };
    const pages: Uint8Array[] = [];
    for (let i = 0; i < Math.min(total, max); i++) {
      const one = await PDFDocument.create();
      const [page] = await one.copyPages(doc, [i]);
      one.addPage(page);
      pages.push(await one.save());
    }
    return { pages, total, locked: false };
  } catch (e) {
    // A file pdf-lib can't take apart may still be readable by the model: send it whole.
    console.error(
      "pdf split failed, sending it whole",
      e instanceof Error ? e.message : e,
    );
    return { pages: [bytes], total: 1, locked: false };
  }
}
