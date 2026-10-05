/** Occupied slots remain necessary for editing historical reservations. */
export function isPurgeableScheduleSlot(id: string, data: { bookings?: unknown }, cutoff: string): boolean {
  const date = id.slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < cutoff && Array.isArray(data.bookings) && data.bookings.length === 0;
}
