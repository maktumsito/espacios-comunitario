import React, { useLayoutEffect, useRef, useState } from 'react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';

const columnCount = () => window.innerWidth >= 1024 ? 4 : window.innerWidth >= 768 ? 3 : window.innerWidth >= 640 ? 2 : 1;

/** Row virtualization preserves the existing responsive reading order. */
export function VirtualCardGrid<T extends { id: string }>({ items, renderItem, fixedColumns, maxHeight = 240, estimatedRowHeight = 92 }: {
  items: T[];
  fixedColumns?: number;
  maxHeight?: number;
  estimatedRowHeight?: number;
  renderItem: (item: T) => React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(()=>fixedColumns || columnCount());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const pendingFocus = useRef<{id:string;last:boolean} | null>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const focusedIndex = items.findIndex(item => item.id === focusedId);
  const virtualizer = useVirtualizer({
    count: Math.ceil(items.length / columns),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 1,
    gap: 10,
    getItemKey: row => `${columns}:${items[row * columns].id}`,
    rangeExtractor: range => {
      const rows = defaultRangeExtractor(range);
      if (focusedIndex >= 0) rows.push(Math.floor(focusedIndex / columns));
      return [...new Set(rows)].sort((a, b) => a - b);
    },
  });
  useLayoutEffect(() => {
    const resize = () => setColumns(fixedColumns || columnCount());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [fixedColumns]);
  useLayoutEffect(() => { virtualizer.measure(); }, [columns, items, virtualizer]);
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const buttons = nodes.current.get(target.id)?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
    const button = target.last ? buttons?.[buttons.length-1] : buttons?.[0];
    if (button) {
      pendingFocus.current = null;
      button.focus({ preventScroll: true });
    }
  });

  return (
    <div ref={scrollRef} className="overflow-y-auto pr-1" style={{ height: Math.min(maxHeight, virtualizer.getTotalSize()) }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(row => (
          <div key={row.key} data-index={row.index} ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)`, display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 10 }}>
            {items.slice(row.index * columns, (row.index + 1) * columns).map((item, offset) => (
              <div key={item.id} data-agenda-reservation-id={item.id}
                ref={node => { if (node) nodes.current.set(item.id, node); else nodes.current.delete(item.id); }}
                onFocusCapture={() => setFocusedId(item.id)}
                onBlurCapture={() => setFocusedId(current => current === item.id ? null : current)}
                onKeyDownCapture={event => {
                  if (event.key !== 'Tab') return;
                  const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
                  const boundary = event.shiftKey ? controls[0] : controls[controls.length-1];
                  if (event.target !== boundary) return;
                  const index = row.index * columns + offset + (event.shiftKey ? -1 : 1);
                  if (index < 0 || index >= items.length) return;
                  event.preventDefault();
                  pendingFocus.current = {id:items[index].id,last:event.shiftKey};
                  setFocusedId(items[index].id);
                  virtualizer.scrollToIndex(Math.floor(index / columns), { align: 'auto' });
                }}>
                {renderItem(item)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
