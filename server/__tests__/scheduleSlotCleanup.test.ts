import { expect, it } from 'vitest';
import { isPurgeableScheduleSlot } from '../scheduleSlotCleanup';
it('purges only old, explicitly empty availability indices',()=> {
  expect(isPurgeableScheduleSlot('2026-08-01_SALA%202',{bookings:[]},'2026-09-01')).toBe(true);
  expect(isPurgeableScheduleSlot('2026-08-01_SALA%202',{bookings:[{id:'historic'}]},'2026-09-01')).toBe(false);
  expect(isPurgeableScheduleSlot('2026-08-01_SALA%202',{},'2026-09-01')).toBe(false);
  expect(isPurgeableScheduleSlot('2026-10-01_SALA%202',{bookings:[]},'2026-09-01')).toBe(false);
});
