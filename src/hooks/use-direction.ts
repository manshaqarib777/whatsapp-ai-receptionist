'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Resolves the writing direction actually in effect for an element.
 *
 * Radix positions popovers, tooltips, and menus on *physical* sides — `side="right"`
 * stays on the right in Arabic, where it would cover the sidebar it belongs to.
 * Anything that picks a side needs to know the real direction, and `dir` may be set
 * on any ancestor (the gallery sets it on a wrapper, not on `<html>`), so the only
 * reliable answer comes from computed style.
 *
 * Returns `'ltr'` on the server and on first paint, then corrects after mount. That
 * is safe here because the values it feeds are only used once a popover opens.
 */
export function useDirection(ref: RefObject<HTMLElement | null>): 'ltr' | 'rtl' {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resolve = () =>
      setDirection(getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr');

    resolve();

    // The direction can change without this element re-rendering — a locale switch,
    // or the gallery's own LTR/RTL toggle on an ancestor.
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir', 'lang'],
      subtree: true,
    });

    return () => observer.disconnect();
  }, [ref]);

  return direction;
}
