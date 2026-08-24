export type VirtualWindow = {
  start: number;
  end: number;
  offset: number;
  totalHeight: number;
};

export function virtualWindow(input: {
  count: number;
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  overscan?: number;
}): VirtualWindow {
  const overscan = input.overscan ?? 3;
  const visibleStart = Math.floor(Math.max(0, input.scrollTop) / input.rowHeight);
  const visibleCount = Math.ceil(
    Math.max(input.rowHeight, input.viewportHeight) / input.rowHeight,
  );
  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(input.count, visibleStart + visibleCount + overscan);
  return {
    start,
    end,
    offset: start * input.rowHeight,
    totalHeight: input.count * input.rowHeight,
  };
}
