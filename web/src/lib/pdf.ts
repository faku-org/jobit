/**
 * Text out of a PDF, in the browser. pdf.js is a large dependency and most
 * people never open this panel, so it is imported the first time a PDF is
 * actually chosen and lands in its own chunk.
 *
 * The file never leaves the page: it is read straight from the File object.
 */
const MAX_PAGES = 12;

interface TextItem {
  str?: string;
  hasEOL?: boolean;
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  /** Vite resolves this to a hashed asset and pdf.js runs it off the main thread. */
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;

  try {
    const pages: string[] = [];

    for (let number = 1; number <= Math.min(document.numPages, MAX_PAGES); number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();

      /** pdf.js hands back positioned runs; the EOL flags rebuild the lines. */
      let line = "";
      const lines: string[] = [];

      for (const item of content.items as TextItem[]) {
        if (typeof item.str !== "string") continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line.trim());
          line = "";
        }
      }
      if (line.trim()) lines.push(line.trim());

      pages.push(lines.join("\n"));
      page.cleanup();
    }

    return pages.join("\n\n");
  } finally {
    document.cleanup();
  }
}
