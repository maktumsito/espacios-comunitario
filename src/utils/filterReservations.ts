import { Reservation, FilterState } from '../types';
import { getFuzzyMatchIds } from './fuzzySearch';

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

  // Normalize boundary dates (handles YYYY, YYYY-MM, YYYY-MM-DD, DD-MM-YYYY)
  const normalizeFilterBoundary = (dateStr: string, boundary: 'start' | 'end'): string | null => {
    const trimmed = (dateStr || '').trim();
    if (!trimmed) return null;
    if (/^\d{4}$/.test(trimmed)) {
      return boundary === 'start' ? `${trimmed}-01-01` : `${trimmed}-12-31`;
    }
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return boundary === 'start' ? `${trimmed}-01` : `${trimmed}-31`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    if (/^\d{2}-\d{2}-\d{4}/.test(trimmed)) {
      const [d, m, y] = trimmed.slice(0, 10).split('-');
      return `${y}-${m}-${d}`;
    }
    return trimmed;
  };

  const normalizeReservationDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    if (/^\d{2}-\d{2}-\d{4}/.test(trimmed)) {
      const [d, m, y] = trimmed.slice(0, 10).split('-');
      return `${y}-${m}-${d}`;
    }
    return trimmed;
  };

  const filterDesde = normalizeFilterBoundary(filters.fechaDesde, 'start');
  const filterHasta = normalizeFilterBoundary(filters.fechaHasta, 'end');
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

    // Date Range (fast normalized ISO comparisons)
    const rFecha = normalizeReservationDate(r.fecha);
    if (filterDesde && rFecha < filterDesde) return false;
    if (filterHasta && rFecha > filterHasta) return false;

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
