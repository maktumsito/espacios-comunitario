import { expect, it } from 'vitest';
import { DateStringSchema } from '../reservationSchema';
it('validates real leap dates and Gregorian century boundaries', () => {
  for (const date of ['2024-02-29','2000-02-29','2026-04-30','0001-01-01']) expect(DateStringSchema.safeParse(date).success).toBe(true);
  for (const date of ['2026-02-29','1900-02-29','2026-04-31','2026-13-01','2026-01-00','0000-01-01','not-a-date']) expect(DateStringSchema.safeParse(date).success).toBe(false);
});
