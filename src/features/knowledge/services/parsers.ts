import { parse } from 'csv-parse/sync';
import { isIP } from 'node:net';
import { parse as parseHtml } from 'node-html-parser';

import { UnprocessableError } from '@/lib/errors';

/**
 * Document parsers (AD-5).
 *
 * Pure-ish functions mapping `(buffer, mimeType, fileName) → extracted text`. Each
 * parser is a plain async function so the worker can call it directly and the unit
 * tests can drive it without a database or a queue. `pdf-parse`, `mammoth` and
 * `csv-parse` are Node-only — none of this ever runs in a browser request.
 */

export type ParseResult = {
  /** The extracted text, or null when the parser produced nothing (e.g. a scanned PDF). */
  text: string | null;
  /** True when the source was a scanned/image PDF that needs OCR. */
  needsOcr: boolean;
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_WEBSITE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 5;

/** Parses an uploaded file buffer into text. */
export async function parseUpload(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ParseResult> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new UnprocessableError('File exceeds the 20 MB upload limit.');
  }

  const lower = fileName.toLowerCase();

  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    return parsePdf(buffer);
  }
  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    return parseDocx(buffer);
  }
  if (
    mimeType === 'text/csv' ||
    mimeType === 'application/csv' ||
    mimeType === 'text/plain' ||
    lower.endsWith('.csv') ||
    lower.endsWith('.txt')
  ) {
    return { text: parseCsv(buffer), needsOcr: false };
  }

  throw new UnprocessableError('Unsupported file type. Upload a PDF, DOCX, or CSV file.');
}

async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    const text = (result.text ?? '').trim();
    if (text.length === 0) {
      // Scanned PDF — no text layer. The worker OCRs the pages instead.
      return { text: null, needsOcr: true };
    }
    return { text, needsOcr: false };
  } catch {
    throw new UnprocessableError('Could not read the PDF. It may be corrupt.');
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  try {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value ?? '').trim();
    return { text: text.length > 0 ? text : null, needsOcr: false };
  } catch {
    throw new UnprocessableError('Could not read the DOCX. It may be corrupt.');
  }
}

function parseCsv(buffer: Buffer): string {
  const records = parse(buffer.toString('utf8'), {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as unknown[][];

  // Render rows as tab-separated lines so retrieval over the extracted text can
  // match cell values as well as column headers.
  const lines = records.map((record) =>
    record.map((cell) => String(cell ?? '')).join('\t'),
  );
  return lines.join('\n').trim();
}

/**
 * Fetches and extracts readable text from a website URL.
 *
 * SSRF guard (R-5): only http(s) is fetched, the resolved address must not be
 * private/loopback, and the response body is capped. The guard runs here, in the
 * worker, never on a caller-provided URL passed straight to fetch.
 */
export async function fetchWebsiteText(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnprocessableError('Only http(s) URLs can be ingested.');
  }

  const response = await fetchPublicWebsite(parsed);

  if (!response.ok) {
    throw new UnprocessableError(`The website responded with status ${response.status}.`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? '0');
  if (contentLength > MAX_WEBSITE_BYTES) {
    throw new UnprocessableError('The website page exceeds the 2 MB fetch limit.');
  }

  const html = await readLimitedText(response);

  const root = parseHtml(html);
  root
    .querySelectorAll('script, style, nav, header, footer, noscript, iframe')
    .forEach((el) => el.remove());
  const text = (root.text ?? '').replace(/\s+/g, ' ').trim();

  if (text.length === 0) {
    throw new UnprocessableError('The website page contained no readable text.');
  }

  return text;
}

async function fetchPublicWebsite(initialUrl: URL): Promise<Response> {
  let current = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicHost(current);
    const response = await fetch(current.toString(), {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'WhatsApp-AI-Receptionist/1.0 (+knowledge-ingestion)' },
    });

    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location)
      throw new UnprocessableError('The website returned an invalid redirect.');
    const next = new URL(location, current);
    if (next.protocol !== 'http:' && next.protocol !== 'https:') {
      throw new UnprocessableError('Website redirects must use http(s).');
    }
    current = next;
  }

  throw new UnprocessableError('The website redirected too many times.');
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_WEBSITE_BYTES) {
      await reader.cancel();
      throw new UnprocessableError('The website page exceeds the 2 MB fetch limit.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Resolves a hostname and refuses private, loopback, and link-local ranges. */
async function assertPublicHost(parsed: URL): Promise<void> {
  // A literal IP (e.g. 127.0.0.1) is checked directly — no DNS round-trip, and
  // a mocked/poisoned resolver cannot smuggle a private address past the guard.
  const literal = isIP(parsed.hostname);
  if (literal !== 0) {
    if (isPrivateAddress(parsed.hostname)) {
      throw new UnprocessableError('The website address resolves to a private network.');
    }
    return;
  }

  const { lookup } = await import('node:dns/promises');
  const addresses = await lookup(parsed.hostname, { all: true });

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new UnprocessableError('The website address resolves to a private network.');
    }
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (isIP(address) === 6) {
    // ::1 loopback, ::ffff: mapped IPv4, fc00::/7 unique-local, fe80::/10 link-local.
    if (address === '::1') return true;
    if (address.toLowerCase().startsWith('::ffff:')) {
      return isPrivateAddress(address.slice('::ffff:'.length));
    }
    if (/^fc/i.test(address) || /^fd/i.test(address)) return true;
    if (/^fe80/i.test(address)) return true;
    return false;
  }
  return true; // Non-IP (e.g. a hostname the resolver returned oddly) — refuse.
}
