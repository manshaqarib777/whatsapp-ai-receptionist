import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

/**
 * Markdown renderer.
 *
 * SECURITY: raw HTML is NOT enabled. `react-markdown` escapes HTML by default and no
 * `rehype-raw` plugin is used, so a `<script>` or `<img onerror>` in the source is
 * rendered as text rather than executed. This is safe by construction rather than by
 * sanitising after the fact, which is the pattern that keeps failing elsewhere.
 *
 * Link protocols are restricted to http/https/mailto — `javascript:` and `data:` URLs
 * are dropped. Covered by tests in markdown.test.tsx.
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

function isSafeHref(href: string | undefined): boolean {
  if (!href) return false;

  // Relative links are same-origin and therefore safe.
  if (href.startsWith('/') || href.startsWith('#')) return true;

  try {
    return ALLOWED_PROTOCOLS.includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'space-y-3 text-sm leading-relaxed',
        '[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold',
        '[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-5',
        '[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:ps-5',
        '[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs',
        '[&_pre]:bg-muted [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3',
        '[&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:italic',
        '[&_table]:w-full [&_td]:py-1 [&_th]:py-1 [&_th]:text-start',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren, ...props }) =>
            isSafeHref(href) ? (
              <a
                {...props}
                href={href}
                target="_blank"
                // noopener prevents the opened page reaching back via window.opener.
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                {linkChildren}
              </a>
            ) : (
              // An unsafe protocol renders as plain text — the content survives, the
              // link does not.
              <span>{linkChildren}</span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
