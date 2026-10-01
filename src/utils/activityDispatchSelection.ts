import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import type { Reservation } from '../types';
import type { EmailDispatchFilterMode } from '../services/gmailDispatchService';

export function getSantiagoDateStr(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Monday through Sunday, using a calendar date rather than the host timezone. */
export function filterDatesToDispatchWeek(dates: string[], referenceDate = getSantiagoDateStr()): string[] {
  const parsed = parseISO(referenceDate);
  if (isNaN(parsed.getTime())) return [];
  const monday = startOfWeek(parsed, { weekStartsOn: 1 });
  const first = format(monday, 'yyyy-MM-dd');
  const last = format(addDays(monday, 6), 'yyyy-MM-dd');
  return [...new Set(dates)].filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= first && date <= last).sort();
}

export function isDispatchableReservation(reservation: Pick<Reservation, 'estado'>): boolean {
  return !['cancelada', 'rechazada', 'eliminada'].includes((reservation.estado || '').trim().toLowerCase());
}

export function isDispatchLoan(reservation: { tipoPrestamo?: string; tipoActividad?: string }): boolean {
  return Boolean(reservation.tipoPrestamo?.trim()) || /pr[eé]stamo/i.test(reservation.tipoActividad || '');
}

/** The same source of truth for previews, email bodies and PDF attachments. */
export function selectDispatchReservations(
  reservations: Reservation[],
  options: {
    dates: string[];
    referenceDate?: string;
    filterMode: EmailDispatchFilterMode;
    selectedActivityTypes?: string[];
    selectedActivityIds?: string[];
  }
): Reservation[] {
  const dates = new Set(filterDatesToDispatchWeek(options.dates, options.referenceDate));
  const types = new Set((options.selectedActivityTypes ?? ['ALL']).map(type => type.trim().toUpperCase()));
  const ids = options.selectedActivityIds === undefined ? undefined : new Set(options.selectedActivityIds);
  return reservations.filter(reservation => {
    if (!dates.has(reservation.fecha) || !isDispatchableReservation(reservation)) return false;
    if (ids && !ids.has(reservation.id)) return false;
    const loan = isDispatchLoan(reservation);
    const selectedType = types.has((reservation.tipoActividad || '').trim().toUpperCase());
    switch (options.filterMode) {
      case 'solo_prestamos': return loan;
      case 'prestamos_y_seleccionadas': return loan || selectedType;
      case 'actividades_seleccionadas':
      case 'todas': return types.has('ALL') || selectedType;
      default: return false;
    }
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || '').localeCompare(b.horaInicio || ''));
}
