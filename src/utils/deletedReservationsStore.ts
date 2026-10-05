let isHydrated = false;
const inMemoryDeletedSet = new Set<string>();

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof localStorage !== 'undefined';
export const DELETED_IDS_KEY = 'reservas_comunitarias_deleted_v1';

function hydrateIfNeeded(): void {
  if (isHydrated) return;
  isHydrated = true;
  if (isBrowser()) {
    try {
      const raw = localStorage.getItem(DELETED_IDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => id && inMemoryDeletedSet.add(id));
        }
      }
    } catch (e) {
      console.warn('Error reading deleted IDs cache', e);
    }
  }
}

function persistToStorage(): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(inMemoryDeletedSet)));
  } catch (e) {
    console.warn('Error saving deleted IDs to localStorage', e);
  }
}

/**
 * Retrieves the Set of reservation IDs marked as deleted or soft-deleted.
 * Works both in browser (with memory cache + localStorage backing) and in-memory fallback.
 */
export function getDeletedIds(): Set<string> {
  hydrateIfNeeded();
  return new Set<string>(inMemoryDeletedSet);
}

/**
 * Records a reservation ID in the local storage deleted tracker to prevent ghost resurrection.
 */
export function recordDeletedId(id: string): void {
  if (!id) return;
  hydrateIfNeeded();
  if (!inMemoryDeletedSet.has(id)) {
    inMemoryDeletedSet.add(id);
    persistToStorage();
  }
}

/**
 * Records multiple reservation IDs in the local storage deleted tracker.
 */
export function recordDeletedIds(ids: string[]): void {
  if (!ids || !ids.length) return;
  hydrateIfNeeded();
  let changed = false;
  ids.forEach((id) => {
    if (id && !inMemoryDeletedSet.has(id)) {
      inMemoryDeletedSet.add(id);
      changed = true;
    }
  });
  if (changed) {
    persistToStorage();
  }
}

/**
 * Removes a reservation ID from the deleted tracker (e.g. on restoration or resurrection).
 */
export function unrecordDeletedId(id: string): void {
  if (!id) return;
  hydrateIfNeeded();
  if (inMemoryDeletedSet.has(id)) {
    inMemoryDeletedSet.delete(id);
    persistToStorage();
  }
}

/**
 * Removes multiple reservation IDs from the deleted tracker.
 */
export function unrecordDeletedIds(ids: string[]): void {
  if (!ids || !ids.length) return;
  hydrateIfNeeded();
  let changed = false;
  ids.forEach((id) => {
    if (id && inMemoryDeletedSet.has(id)) {
      inMemoryDeletedSet.delete(id);
      changed = true;
    }
  });
  if (changed) {
    persistToStorage();
  }
}

