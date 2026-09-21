import { useLayoutEffect, useState, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export function intersectsViewport(top: number, height: number, start: number, end: number) {
  return top < end && top + height > start;
}

/** The sticky header occupies scroll space but is not part of the timeline. */
export function useTimelineViewport(
  scrollRef: RefObject<HTMLDivElement | null>,
  headerRef: RefObject<HTMLDivElement | null>,
  hours: number,
  hourHeight: number,
) {
  const [headerHeight, setHeaderHeight] = useState(0);
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [headerRef]);
  const virtualizer = useVirtualizer({
    count: hours,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => hourHeight,
    scrollMargin: headerHeight,
    overscan: 2,
  });
  const rows = virtualizer.getVirtualItems();
  return {
    start: rows.length ? rows[0].start - headerHeight : 0,
    end: rows.length ? rows[rows.length - 1].end - headerHeight : 0,
  };
}
