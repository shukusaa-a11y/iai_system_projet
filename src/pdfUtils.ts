// Client-side PDF text extraction using pdfjs-dist.
// The library is dynamically imported so it only loads when a PDF is uploaded,
// keeping the main bundle small.
import type * as PdfjsType from 'pdfjs-dist';

let pdfjsPromise: Promise<typeof PdfjsType> | null = null;

async function getPdfjs(): Promise<typeof PdfjsType> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      // Worker is loaded as a URL via Vite's ?url suffix on a separate chunk.
      // We import it dynamically to keep it out of the main bundle.
      import('pdfjs-dist/build/pdf.worker.min.mjs?url').then((workerMod) => {
        mod.GlobalWorkerOptions.workerSrc = workerMod.default;
      });
      return mod;
    });
  }
  return pdfjsPromise;
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  const maxPages = Math.min(pdf.numPages, 20);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    text += pageText + '\n\n';
  }
  return text.trim();
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
