import { PDFParse } from 'pdf-parse';
import { createWorker, type Worker } from 'tesseract.js';

import { UnprocessableError } from '@/lib/errors';

/**
 * OCR for scanned/image PDFs (AD-5).
 *
 * Runs inside the ingestion worker (Node), never in a browser request. A worker
 * instance is created once and reused; tesseract.js downloads the language model
 * on first use, so the first OCR is slow and the worker should stay warm.
 *
 * The text layer is tried first (see `parsers.ts`); this module is the fallback
 * for PDFs whose `pdf-parse` extraction came back empty. Each page is rendered to
 * an image with `PDFParse.getScreenshot` and OCR'd with tesseract.js.
 */

let sharedWorker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!sharedWorker) {
    sharedWorker = createWorker('eng').then((worker) => worker);
  }
  return sharedWorker;
}

/**
 * OCRs a PDF buffer page by page and returns the concatenated text.
 *
 * @param buffer    The PDF bytes.
 * @param pageCount The number of pages to OCR (the parser reports the total).
 */
export async function ocrPdf(buffer: Buffer, pageCount: number): Promise<string> {
  const worker = await getWorker();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const pages: string[] = [];

  try {
    const pagesToOcr = Array.from({ length: pageCount }, (_, index) => index + 1);
    const screenshots = await parser.getScreenshot({
      partial: pagesToOcr,
      imageBuffer: true,
    });

    for (const shot of screenshots.pages) {
      const image = Buffer.from(shot.data);
      const { data } = await worker.recognize(image);
      pages.push((data.text ?? '').trim());
    }
  } catch {
    throw new UnprocessableError('OCR failed on the scanned PDF.');
  } finally {
    await parser.destroy();
  }

  return pages.join('\n\n').trim();
}

/** Releases the shared worker (used by the worker's shutdown path and tests). */
export async function closeOcr(): Promise<void> {
  if (sharedWorker) {
    const worker = await sharedWorker;
    await worker.terminate();
    sharedWorker = null;
  }
}
