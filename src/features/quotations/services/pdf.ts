import type { QuoteRow } from '@/features/quotations/repositories/quotations.repository';

/**
 * Minimal PDF generation — Milestone 11 (PDF requirement).
 *
 * A deliberately small, dependency-free PDF writer: Helvetica text on an A4
 * page, one line at a time. Enough to produce a real, printable, readable quote
 * document with a table of line items, VAT breakdown, branding colors, and a
 * footer. No embedded images (logo support is a `logoKey` in branding for a
 * later milestone), no page-break reflow beyond a fixed cap.
 *
 * The writer emits a valid PDF 1.4 with a cross-reference table, so any viewer
 * (browser, Preview, qpdf) opens it. The unit test asserts the structure
 * (`%PDF-`, page count, embedded text) rather than pixel output.
 */

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const LINE_HEIGHT = 14;
const BODY = 10;
const SMALL = 8;
const HEADER = 16;

type PdfPrimitive = number | string | PdfPrimitive[];

/** Escapes PDF string literals (parentheses and backslash). */
function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** One text line at (x, y) in PDF points, y from the TOP of the page. */
function textLine(
  x: number,
  y: number,
  text: string,
  size = BODY,
  color = '0 0 0',
): string {
  return `BT /F1 ${size} Tf ${color} rg ${x.toFixed(2)} ${(PAGE_HEIGHT - y).toFixed(2)} Td (${escapeText(text)}) Tj ET`;
}

function formatMoney(value: number, currency: string): string {
  return `${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toISOString().slice(0, 10);
}

/**
 * Renders a quote to a PDF buffer.
 *
 * Layout: header (quote number + status), customer line, a table of line items
 * with VAT, totals (subtotal / VAT / total), validity, and a footer from the
 * template branding when present.
 */
export function renderQuotePdf(
  quote: QuoteRow,
  branding?: {
    footer?: string | null;
    colors?: Record<string, string> | null;
  } | null,
): Buffer {
  const pages: string[][] = [[]];
  let y = MARGIN;
  const currentPage = () => pages[pages.length - 1] as string[];
  const push = (line: string) => currentPage().push(line);

  const headerColor = pdfColor(branding?.colors?.['primary']) ?? '0.18 0.35 0.62';
  const muted = '0.45 0.45 0.45';

  // Header
  push(textLine(MARGIN, y, `QUOTE ${quote.number}`, HEADER, headerColor));
  y += 20;
  push(textLine(MARGIN, y, `Status: ${quote.status.toUpperCase()}`, SMALL, muted));
  y += LINE_HEIGHT;
  push(textLine(MARGIN, y, `Customer: ${quote.contactName ?? quote.contactId}`, BODY));
  y += LINE_HEIGHT;
  push(textLine(MARGIN, y, `Issued: ${formatDate(quote.createdAt)}`, SMALL, muted));
  y += 2 * LINE_HEIGHT;

  // Table header
  push(textLine(MARGIN, y, 'Description', BODY, headerColor));
  push(textLine(MARGIN + 300, y, 'Qty', BODY, headerColor));
  push(textLine(MARGIN + 350, y, 'Unit', BODY, headerColor));
  push(textLine(MARGIN + 430, y, 'Line total', BODY, headerColor));
  y += LINE_HEIGHT;

  for (const line of quote.lineItems) {
    if (y > PAGE_HEIGHT - 160) {
      pages.push([]);
      y = MARGIN;
    }
    push(textLine(MARGIN, y, line.description.slice(0, 52), BODY));
    push(textLine(MARGIN + 300, y, String(line.quantity), BODY));
    push(
      textLine(MARGIN + 350, y, formatMoney(line.unitPriceAmount, quote.currency), BODY),
    );
    push(
      textLine(MARGIN + 430, y, formatMoney(line.lineTotalAmount, quote.currency), BODY),
    );
    y += LINE_HEIGHT;
  }

  // Totals
  y += LINE_HEIGHT;
  push(textLine(MARGIN + 350, y, 'Subtotal', BODY));
  push(
    textLine(MARGIN + 430, y, formatMoney(quote.subtotalAmount, quote.currency), BODY),
  );
  y += LINE_HEIGHT;
  push(textLine(MARGIN + 350, y, 'VAT', BODY));
  push(textLine(MARGIN + 430, y, formatMoney(quote.taxAmount, quote.currency), BODY));
  y += LINE_HEIGHT;
  push(textLine(MARGIN + 350, y, 'Total', BODY, headerColor));
  push(
    textLine(
      MARGIN + 430,
      y,
      formatMoney(quote.totalAmount, quote.currency),
      BODY,
      headerColor,
    ),
  );
  y += 2 * LINE_HEIGHT;

  push(textLine(MARGIN, y, `Valid until: ${formatDate(quote.validUntil)}`, SMALL, muted));
  y += LINE_HEIGHT;

  if (branding?.footer) {
    if (y > PAGE_HEIGHT - 80) {
      pages.push([]);
      y = MARGIN;
    }
    push(textLine(MARGIN, y, branding.footer.slice(0, 120), SMALL, muted));
  }

  return buildPdf(pages);
}

/** Serialises content pages into a valid PDF 1.4 document with xref. */
function buildPdf(pages: string[][]): Buffer {
  const objects: { stream?: string; dict: Record<string, PdfPrimitive> }[] = [];
  const fontObjectId = 3 + pages.length * 2;

  // Object 1: Catalog
  objects.push({ dict: { Type: '/Catalog', Pages: '2 0 R' } });
  // Object 2: Pages
  objects.push({
    dict: {
      Type: '/Pages',
      Kids: pages.map((_, i) => `${3 + i * 2} 0 R`),
      Count: pages.length,
    },
  });

  for (const lines of pages) {
    // Page object
    objects.push({
      dict: {
        Type: '/Page',
        Parent: '2 0 R',
        MediaBox: `[0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
        Contents: `${objects.length + 2} 0 R`,
        Resources: `<< /Font << /F1 ${fontObjectId} 0 R >> >>`,
      },
    });
    // Content stream
    const content = lines.join('\n');
    objects.push({ stream: content, dict: {} });
  }

  // Font object (always after all pages, referenced as 4 0 R above)
  objects.push({
    dict: {
      Type: '/Font',
      Subtype: '/Type1',
      BaseFont: '/Helvetica',
      Encoding: '/WinAnsiEncoding',
    },
  });

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];

  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    const body =
      obj.stream !== undefined
        ? `${serializeDict(obj.dict)}\nstream\n${obj.stream}\nendstream`
        : serializeDict(obj.dict);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

function pdfColor(value: string | undefined): string | null {
  const match = value?.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1] ?? '';
  return [0, 2, 4]
    .map((offset) =>
      (Number.parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(3),
    )
    .join(' ');
}

function serializeDict(dict: Record<string, PdfPrimitive>): string {
  const entries = Object.entries(dict)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (typeof value === 'number') return `/${key} ${value}`;
      if (Array.isArray(value)) return `/${key} [${value.join(' ')}]`;
      return `/${key} ${value}`;
    });
  return `<< ${entries.join(' ')} >>`;
}
