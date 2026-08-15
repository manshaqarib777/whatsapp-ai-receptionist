import type { InvoiceRow } from '@/features/invoices/repositories/invoices.repository';

/**
 * Minimal invoice PDF generation — Milestone 12.
 *
 * Same dependency-free PDF 1.4 writer pattern as quotations: Helvetica on A4,
 * one line at a time. Prints the invoice header, customer, line-item table,
 * VAT breakdown, totals, amount paid / balance due, and the payment terms.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const LINE_HEIGHT = 14;
const BODY = 10;
const SMALL = 8;
const HEADER = 16;

type PdfPrimitive = number | string | PdfPrimitive[];

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

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

export function renderInvoicePdf(invoice: InvoiceRow): Buffer {
  const pages: string[][] = [[]];
  let y = MARGIN;
  const currentPage = () => pages[pages.length - 1] as string[];
  const push = (line: string) => currentPage().push(line);

  const headerColor = '0.18 0.35 0.62';
  const muted = '0.45 0.45 0.45';

  push(textLine(MARGIN, y, `INVOICE ${invoice.number}`, HEADER, headerColor));
  y += 20;
  push(textLine(MARGIN, y, `Status: ${invoice.status.toUpperCase()}`, SMALL, muted));
  y += LINE_HEIGHT;
  push(
    textLine(MARGIN, y, `Customer: ${invoice.contactName ?? invoice.contactId}`, BODY),
  );
  y += LINE_HEIGHT;
  push(
    textLine(
      MARGIN,
      y,
      `Issued: ${formatDate(invoice.issuedAt ?? invoice.createdAt)}`,
      SMALL,
      muted,
    ),
  );
  y += LINE_HEIGHT;
  push(textLine(MARGIN, y, `Due: ${formatDate(invoice.dueAt)}`, SMALL, muted));
  y += 2 * LINE_HEIGHT;

  push(textLine(MARGIN, y, 'Description', BODY, headerColor));
  push(textLine(MARGIN + 300, y, 'Qty', BODY, headerColor));
  push(textLine(MARGIN + 350, y, 'Unit', BODY, headerColor));
  push(textLine(MARGIN + 430, y, 'Line total', BODY, headerColor));
  y += LINE_HEIGHT;

  for (const line of invoice.lineItems) {
    if (y > PAGE_HEIGHT - 200) {
      pages.push([]);
      y = MARGIN;
    }
    push(textLine(MARGIN, y, line.description.slice(0, 52), BODY));
    push(textLine(MARGIN + 300, y, String(line.quantity), BODY));
    push(
      textLine(
        MARGIN + 350,
        y,
        formatMoney(line.unitPriceAmount, invoice.currency),
        BODY,
      ),
    );
    push(
      textLine(
        MARGIN + 430,
        y,
        formatMoney(line.lineTotalAmount, invoice.currency),
        BODY,
      ),
    );
    y += LINE_HEIGHT;
  }

  y += LINE_HEIGHT;
  push(textLine(MARGIN + 350, y, 'Subtotal', BODY));
  push(
    textLine(
      MARGIN + 430,
      y,
      formatMoney(invoice.subtotalAmount, invoice.currency),
      BODY,
    ),
  );
  y += LINE_HEIGHT;
  push(textLine(MARGIN + 350, y, 'VAT', BODY));
  push(textLine(MARGIN + 430, y, formatMoney(invoice.taxAmount, invoice.currency), BODY));
  y += LINE_HEIGHT;
  push(textLine(MARGIN + 350, y, 'Total', BODY, headerColor));
  push(
    textLine(
      MARGIN + 430,
      y,
      formatMoney(invoice.totalAmount, invoice.currency),
      BODY,
      headerColor,
    ),
  );
  y += LINE_HEIGHT;
  push(textLine(MARGIN + 350, y, 'Paid', BODY));
  push(
    textLine(MARGIN + 430, y, formatMoney(invoice.amountPaid, invoice.currency), BODY),
  );
  y += LINE_HEIGHT;
  push(textLine(MARGIN + 350, y, 'Balance due', BODY, headerColor));
  push(
    textLine(
      MARGIN + 430,
      y,
      formatMoney(
        Math.max(0, invoice.totalAmount - invoice.amountPaid),
        invoice.currency,
      ),
      BODY,
      headerColor,
    ),
  );
  y += 2 * LINE_HEIGHT;

  if (invoice.status === 'paid') {
    push(
      textLine(MARGIN, y, `Paid in full on ${formatDate(invoice.paidAt)}.`, SMALL, muted),
    );
  } else if (invoice.dueAt) {
    push(textLine(MARGIN, y, `Payment due ${formatDate(invoice.dueAt)}.`, SMALL, muted));
  }

  return buildPdf(pages);
}

/** Serialises content pages into a valid PDF 1.4 document with xref. */
function buildPdf(pages: string[][]): Buffer {
  const objects: { stream?: string; dict: Record<string, PdfPrimitive> }[] = [];

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
        Resources: `<< /Font << /F1 4 0 R >> >>`,
      },
    });
    // Content stream
    const content = lines.join('\n');
    objects.push({ stream: content, dict: {} });
  }

  // Font object (always after all pages, referenced as 4 0 R above)
  const fontObjectIndex = 3 + pages.length * 2 + 1;
  objects[fontObjectIndex - 1] = {
    dict: {
      Type: '/Font',
      Subtype: '/Type1',
      BaseFont: '/Helvetica',
      Encoding: '/WinAnsiEncoding',
    },
  };

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
