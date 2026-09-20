/**
 * Development Firestore Read Tracker
 * Tracks read operations per module to monitor quota consumption and detect unoptimized listeners.
 */

interface FirestoreReadStats {
  [module: string]: number;
}

const READS_STORAGE_KEY = 'dev_firestore_reads_tracker_v1';

let inMemoryReads: FirestoreReadStats = {};

function loadPersistedReads(): FirestoreReadStats {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return inMemoryReads;
  }
  try {
    const raw = sessionStorage.getItem(READS_STORAGE_KEY);
    if (raw) {
      inMemoryReads = JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return inMemoryReads;
}

function persistReads(): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(READS_STORAGE_KEY, JSON.stringify(inMemoryReads));
  } catch {
    // ignore
  }
}

/**
 * Records a read batch for a given module/collection.
 * In development, prints an informational debug notice.
 */
export function recordFirestoreRead(module: string, count: number): void {
  if (!module || count <= 0) return;
  loadPersistedReads();

  inMemoryReads[module] = (inMemoryReads[module] || 0) + count;
  persistReads();

  if ((import.meta as any).env?.DEV) {
    const totalModule = inMemoryReads[module];
    const totalAll = getTotalFirestoreReads();
    console.debug(
      `📊 [Firestore Read Tracker] ${module}: +${count} lectura(s) | Módulo: ${totalModule} | Total Sesión: ${totalAll}`
    );
  }
}

/**
 * Returns current read statistics broken down by module.
 */
export function getFirestoreReadStats(): FirestoreReadStats {
  return { ...loadPersistedReads() };
}

/**
 * Returns total cumulative reads across all tracked modules.
 */
export function getTotalFirestoreReads(): number {
  const stats = loadPersistedReads();
  return Object.values(stats).reduce((acc, val) => acc + val, 0);
}

/**
 * Resets the read tracker for the current session.
 */
export function resetFirestoreReadTracker(): void {
  inMemoryReads = {};
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(READS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
