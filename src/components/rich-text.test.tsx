import { generateJSON } from '@tiptap/core';
import { describe, expect, it } from 'vitest';

import { richTextExtensions, richTextToHtml } from '@/components/rich-text';

/**
 * Rich text sanitisation.
 *
 * The claim being tested is that the *schema* is the allow-list: content is parsed
 * into a document that can only contain nodes and marks the schema describes, so
 * anything else is dropped on the way in rather than escaped on the way out.
 *
 * Each case below feeds hostile HTML through the same path as a paste from the
 * clipboard or a value loaded from the database, and asserts on the HTML that would
 * eventually be rendered.
 */

/** Parse HTML through the schema, then render it back — the full round trip. */
function roundTrip(html: string): string {
  return richTextToHtml(generateJSON(html, richTextExtensions));
}

describe('rich text — content the schema allows', () => {
  it('keeps paragraphs, bold, and italic', () => {
    const html = roundTrip('<p>We are <strong>open</strong> and <em>busy</em></p>');

    expect(html).toContain('<strong>open</strong>');
    expect(html).toContain('<em>busy</em>');
  });

  it('keeps headings, lists, and quotes', () => {
    const html = roundTrip(
      '<h2>Hours</h2><ul><li>Monday</li></ul><ol><li>First</li></ol><blockquote><p>Closed</p></blockquote>',
    );

    expect(html).toContain('<h2>Hours</h2>');
    expect(html).toContain('<ul><li><p>Monday</p></li></ul>');
    expect(html).toContain('<ol><li><p>First</p></li></ol>');
    expect(html).toContain('<blockquote>');
  });

  it('demotes an h1 rather than letting body content break the page outline', () => {
    const html = roundTrip('<h1>Shouting</h1>');

    expect(html).not.toContain('<h1>');
    expect(html).toContain('Shouting');
  });
});

describe('rich text — sanitisation', () => {
  it('drops a script tag entirely', () => {
    const html = roundTrip('<p>Hello</p><script>window.pwned = true</script>');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('window.pwned');
    expect(html).toContain('Hello');
  });

  it('drops an image with an onerror handler', () => {
    const html = roundTrip('<p>Hi</p><img src="x" onerror="window.pwned = true">');

    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror');
  });

  it('drops an iframe', () => {
    const html = roundTrip('<iframe src="https://evil.example"></iframe><p>Hi</p>');

    expect(html).not.toContain('<iframe');
  });

  it('drops event handler attributes from allowed elements', () => {
    const html = roundTrip('<p onclick="window.pwned = true">Hello</p>');

    expect(html).not.toContain('onclick');
    expect(html).toContain('Hello');
  });

  it('drops inline styles, so content cannot overlay the interface', () => {
    const html = roundTrip(
      '<p style="position:fixed;inset:0;background:red">Cover everything</p>',
    );

    expect(html).not.toContain('style=');
  });

  it('refuses a javascript: link but keeps its text', () => {
    const html = roundTrip('<a href="javascript:alert(1)">Click me</a>');

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a ');
    expect(html).toContain('Click me');
  });

  it('refuses a data: link', () => {
    const html = roundTrip(
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click me</a>',
    );

    expect(html).not.toContain('data:text/html');
    expect(html).not.toContain('<a ');
  });

  it('keeps an https link and hardens it', () => {
    const html = roundTrip('<a href="https://example.com">Book</a>');

    expect(html).toContain('href="https://example.com"');
    // Without noopener the opened page can reach back through window.opener.
    expect(html).toContain('noopener');
  });

  it('keeps a mailto link', () => {
    const html = roundTrip('<a href="mailto:hello@example.com">Email</a>');

    expect(html).toContain('mailto:hello@example.com');
  });
});

describe('richTextToHtml', () => {
  it('renders a stored document without touching the DOM', () => {
    const html = richTextToHtml({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Open' }],
        },
      ],
    });

    expect(html).toBe('<p><strong>Open</strong></p>');
  });

  it('re-filters a document written under a laxer schema', () => {
    // Storing JSON rather than HTML is what makes this possible: an unknown node from
    // an older version is dropped by today's schema on the way out.
    const html = richTextToHtml({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Kept' }] },
        { type: 'somethingRemoved', content: [{ type: 'text', text: 'Dropped' }] },
      ],
    });

    expect(html).toContain('Kept');
    expect(html).not.toContain('somethingRemoved');
  });
});
