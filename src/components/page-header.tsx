import { Fragment, type ReactNode } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

/**
 * Sticky page header.
 *
 * COMPONENT_DESIGN.md §6: 56px, `--background` with a backdrop blur, hairline bottom
 * border, page title or breadcrumb at the start and page-level actions at the end.
 * It deliberately does **not** repeat sidebar navigation — two places to click the
 * same thing is two places to keep in sync.
 *
 * Breadcrumbs appear only past two levels, and the current page is text rather than
 * a link: a link to where you already are is noise.
 */

export type Crumb = {
  label: string;
  /** Omit on the final crumb — the current page is not a link. */
  href?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  /** Mobile menu button, supplied by the shell that owns the drawer. */
  leading,
  className,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  // Two levels is just "section → page", which the title already says.
  const showBreadcrumbs = breadcrumbs !== undefined && breadcrumbs.length > 2;

  return (
    <header
      className={cn(
        'bg-background/80 sticky top-0 z-20 border-b backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {leading}

          <div className="min-w-0 space-y-0.5">
            {showBreadcrumbs ? (
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;

                    return (
                      // The separator is a SIBLING of the item, not a child of it:
                      // `BreadcrumbSeparator` renders an <li>, and an <li> inside an
                      // <li> is invalid HTML that the browser silently reshuffles —
                      // which shows up as a hydration mismatch, not as a lint error.
                      <Fragment key={`${crumb.label}-${index}`}>
                        <BreadcrumbItem>
                          {isLast || !crumb.href ? (
                            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink href={crumb.href}>
                              {crumb.label}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {!isLast ? <BreadcrumbSeparator /> : null}
                      </Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}

            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>

            {description ? (
              <p className="text-muted-foreground truncate text-sm">{description}</p>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
