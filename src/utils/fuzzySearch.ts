import Fuse, { IFuseOptions } from 'fuse.js';
import { Reservation } from '../types';

const defaultFuseOptions: IFuseOptions<Reservation> = {
  keys: [
    { name: 'responsable', weight: 0.35 },
    { name: 'descripcion', weight: 0.25 },
    { name: 'tipoActividad', weight: 0.15 },
    { name: 'espacio', weight: 0.15 },
    { name: 'rut', weight: 0.1 },
    { name: 'emailContacto', weight: 0.05 },
    { name: 'telefonoContacto', weight: 0.05 },
    { name: 'id', weight: 0.05 }
  ],
  threshold: 0.38, // Allows spelling typos e.g. "auditoro" -> "auditorio", "gonzales" -> "González"
  distance: 100,
  ignoreLocation: true,
  minMatchCharLength: 2,
  shouldSort: true
};

/**
 * Searches a list of reservations using Fuse.js fuzzy matching with exact substring fallback.
 */
export function fuzzySearchReservations(
  reservations: Reservation[],
  query: string
): Reservation[] {
  const trimmed = query.trim();
  if (!trimmed) return reservations;

  // Clean RUT digits for exact RUT match priority
  const cleanRutQ = trimmed.replace(/[^0-9kK]/g, '').toLowerCase();
  const normQ = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const fuse = new Fuse(reservations, defaultFuseOptions);
  const fuseResults = fuse.search(trimmed);
  const fuseMatchedIds = new Set(fuseResults.map((r) => r.item.id));

  // Also include exact substring matches (e.g. partial RUT or exact words) that might have score above threshold
  const fallbackMatches: Reservation[] = [];
  for (const r of reservations) {
    if (fuseMatchedIds.has(r.id)) continue;

    if (cleanRutQ.length >= 3) {
      const cleanR = (r.rut || '').replace(/[^0-9kK]/g, '').toLowerCase();
      if (cleanR.includes(cleanRutQ)) {
        fallbackMatches.push(r);
        continue;
      }
    }

    const normDesc = (r.descripcion || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normResp = (r.responsable || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normEsp = (r.espacio || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normTipo = (r.tipoActividad || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (
      normDesc.includes(normQ) ||
      normResp.includes(normQ) ||
      normEsp.includes(normQ) ||
      normTipo.includes(normQ) ||
      r.id.toLowerCase().includes(normQ)
    ) {
      fallbackMatches.push(r);
    }
  }

  return [...fuseResults.map((r) => r.item), ...fallbackMatches];
}

/**
 * Returns a Set of matching IDs for high performance filtering within filter pipelines
 */
export function getFuzzyMatchIds(
  reservations: Reservation[],
  query: string
): Set<string> {
  const matches = fuzzySearchReservations(reservations, query);
  return new Set(matches.map((r) => r.id));
}

/**
 * Generic fuzzy search helper for any array of objects using Fuse.js
 */
export function fuzzySearchItems<T>(
  items: readonly T[],
  query: string,
  keys: string[],
  threshold = 0.4
): T[] {
  const trimmed = (query || '').trim();
  if (!trimmed) return [...items];

  const fuse = new Fuse(items as T[], {
    keys,
    threshold,
    distance: 100,
    ignoreLocation: true,
    minMatchCharLength: 2,
    shouldSort: true
  });

  const fuseResults = fuse.search(trimmed);
  return fuseResults.map((res) => res.item);
}

