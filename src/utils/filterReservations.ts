import { Reservation, FilterState } from '../types';
import { getFuzzyMatchIds } from './fuzzySearch';

/**
 * Normalizes any date input (YYYY, YYYY-MM, YYYY-MM-DD, DD-MM-YYYY, with slashes, dashes, or dots)
 * into a standard comparable ISO string (YYYY-MM-DD) without ANY timezone shift.
 */
export function normalizeDateToComparableIso(
  dateStr: string | null | undefined,
  boundary: 'start' | 'end' = 'start'
): string | null {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;

  // Year only: '2027' -> 2027-01-01 or 2027-12-31
  if (/^\d{4}$/.test(trimmed)) {
    return boundary === 'start' ? `${trimmed}-01-01` : `${trimmed}-12-31`;
  }

  // Year-Month: '2027-01' or '2027/01' -> 2027-01-01 or 2027-01-31
  if (/^\d{4}[-/.]\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split(/[-/.]/);
    const y = parts[0];
    const mm = parts[1].padStart(2, '0');
    return boundary === 'start' ? `${y}-${mm}-01` : `${y}-${mm}-31`;
  }

  // ISO timestamp: '2027-01-01T...' or '2027-01-01 ...'
  if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(trimmed)) {
    const parts = trimmed.split(/[-/.]/);
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].slice(0, 2).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(trimmed)) {
    const parts = trimmed.split(/[-/.]/);
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2].slice(0, 4);
    return `${y}-${m}-${d}`;
  }

  return trimmed;
}

export function filterReservations(
  reservations: Reservation[],
  filters: FilterState,
  conflictReservationIds: ReadonlySet<string> = new Set()
): Reservation[] {
  const rawSearch = filters.search ? filters.search.trim() : '';
  const hasSearch = Boolean(rawSearch);
  const fuzzyMatchIds = hasSearch ? getFuzzyMatchIds(reservations, rawSearch) : null;

  const filterEspacio = filters.espacio ? filters.espacio.toUpperCase() : null;
  const filterTipo = filters.tipoActividad || null;

  const filterDesde = normalizeDateToComparableIso(filters.fechaDesde, 'start');
  const filterHasta = normalizeDateToComparableIso(filters.fechaHasta, 'end');
  const filterRecurrentes = Boolean(filters.soloRecurrentes);
  const filterImportantes = Boolean(filters.soloImportantes);
  const filterTopamiento = Boolean(filters.soloConTopamiento);

  // If date range is invalid (Desde > Hasta), return empty array
  if (filterDesde && filterHasta && filterDesde > filterHasta) {
    return [];
  }

  return reservations.filter((r) => {
    // Topamientos filter
    if (filterTopamiento && !conflictReservationIds.has(r.id)) {
      return false;
    }

    // Quick Toggles
    if (filterRecurrentes && r.actividadRecurrente !== 'Sí') return false;
    if (filterImportantes && r.importante !== 'Sí') return false;

    // Date Range: inclusive condition: reserva.fecha >= fechaDesde && reserva.fecha <= fechaHasta
    const rFecha = normalizeDateToComparableIso(r.fecha, 'start');
    if (filterDesde && (!rFecha || rFecha < filterDesde)) return false;
    if (filterHasta && (!rFecha || rFecha > filterHasta)) return false;

    // Espacio
    if (filterEspacio && r.espacio.toUpperCase() !== filterEspacio) {
      return false;
    }

    // Tipo Actividad
    if (filterTipo && r.tipoActividad !== filterTipo) {
      return false;
    }

    // Fuzzy Search with typo tolerance, accent insensitivity & clean RUT support
    if (hasSearch && fuzzyMatchIds && !fuzzyMatchIds.has(r.id)) {
      return false;
    }

    return true;
  });
}
