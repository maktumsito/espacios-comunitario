// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { showPrintBlob } from '../printWindow';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('retains a slow PDF viewer URL until its window closes', () => {
  vi.useFakeTimers();
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL });
  const viewer = { closed: false, location: { href: '' }, focus: vi.fn() };
  showPrintBlob(viewer as unknown as Window, new Blob(['pdf']));
  expect(viewer.location.href).toBe('blob:test');
  vi.advanceTimersByTime(60_000);
  expect(revokeObjectURL).not.toHaveBeenCalled();
  viewer.closed = true;
  vi.advanceTimersByTime(1000);
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:test');
  expect(vi.getTimerCount()).toBe(0);
});
