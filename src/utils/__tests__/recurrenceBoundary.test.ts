import { describe, it, expect } from 'vitest';
import { generateRecurrenceDates } from '../dateUtils';

describe('Recurrence Boundary Tests (Hallazgo 6)', () => {
  it('includes the end date when starting and ending on a Tuesday', () => {
    const startTuesday = '2026-09-01'; // Tuesday
    const endTuesday = '2026-09-15';   // Tuesday
    const selectedTuesdays = [2];

    const result1 = generateRecurrenceDates(startTuesday, endTuesday, selectedTuesdays);
    expect(result1).toContain(endTuesday);
    expect(result1[result1.length - 1]).toBe(endTuesday);
    expect(result1.length).toBe(3);
    expect(result1).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
  });

  it('correctly handles Monday + Wednesday pattern ending on a Wednesday', () => {
    const startMW = '2026-10-05'; // Monday
    const endMW = '2026-10-14';   // Wednesday
    const selectedMW = [1, 3]; // Mon, Wed

    const result2 = generateRecurrenceDates(startMW, endMW, selectedMW);
    expect(result2).toContain(endMW);
    expect(result2[result2.length - 1]).toBe(endMW);
    expect(result2).toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']);
  });

  it('handles single day range matching selected day', () => {
    const singleDay = '2026-11-06'; // Friday (day 5)
    const result3 = generateRecurrenceDates(singleDay, singleDay, [5]);
    expect(result3).toEqual([singleDay]);
  });
});
