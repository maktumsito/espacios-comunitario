import type { Reservation } from '../types';
import { getConstituentSpaces, getTimeIntervalsForReservation } from './conflictDetector';
export type AvailabilityIndex = Map<string, Reservation[]>;
export function buildAvailabilityIndex(rows: readonly Reservation[]): AvailabilityIndex {
  const index:AvailabilityIndex = new Map();
  for (const row of rows) for (const interval of getTimeIntervalsForReservation(row)) {
    for (const room of new Set(getConstituentSpaces(row.espacio))) {
      const key = `${interval.date}|${room}`;
      const list=index.get(key); if(list) list.push(row); else index.set(key,[row]);
    }
  }
  return index;
}
/** Includes both sides of midnight and every constituent room. */
export function getAvailabilityCandidates(index: AvailabilityIndex, candidate: Partial<Reservation>): Reservation[] {
  const rows=new Set<Reservation>();
  for(const interval of getTimeIntervalsForReservation(candidate)) for(const room of getConstituentSpaces(candidate.espacio)) {
    index.get(`${interval.date}|${room}`)?.forEach(row=>rows.add(row));
  }
  return [...rows];
}
