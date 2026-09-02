import type { ExtractedPage } from './types';

/** Extracts positioned text entirely in the browser. The PDF bytes never leave the device. */
export async function extractPdfPagesWeb(data: ArrayBuffer): Promise<ExtractedPage[]> {
  if (typeof window === 'undefined') throw new Error('Web PDF extraction requires a browser');

  // The webpack entry creates a local module worker from the installed pdfjs-dist package.
  // No CDN or remote worker is used.
  const pdfjs = await import('pdfjs-dist/webpack.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is Extract<typeof item, { str: string }> => 'str' in item)
      .map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: viewport.height - item.transform[5],
        width: item.width,
      }));
    pages.push({ items, width: viewport.width, height: viewport.height });
  }

  return pages;
}
