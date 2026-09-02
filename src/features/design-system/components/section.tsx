import type { ReactNode } from 'react';

/**
 * A titled block in the gallery.
 *
 * Labelled rather than merely styled, so the gallery itself passes the same
 * accessibility bar it exists to verify: every section is a landmark a screen-reader
 * user can jump between.
 */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2
          id={`${id}-heading`}
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** A labelled row inside a section — one component, one line of explanation. */
export function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      {label ? <p className="text-muted-foreground text-xs">{label}</p> : null}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
