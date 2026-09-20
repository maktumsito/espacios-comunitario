/**
 * Spanish Pluralization Utilities for Gestión de Espacios Comunitarios
 * Guarantees correct grammatical agreement for counts (0, 1, 2+) across UI components.
 */

/**
 * Returns a formatted string with the number and proper singular/plural noun.
 * In Spanish, 0 takes the plural form (e.g., 0 actividades, 0 espacios).
 *
 * @param count The number of elements
 * @param singular The singular form of the noun (e.g., "actividad", "espacio")
 * @param plural The plural form of the noun (e.g., "actividades", "espacios")
 * @returns e.g., "1 actividad", "2 actividades", "0 actividades"
 */
export function pluralize(count: number, singular: string, plural: string): string {
  const safeCount = typeof count === 'number' && !isNaN(count) ? count : 0;
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
}

/**
 * Formats activity counts with grammatical agreement.
 * Examples: "0 actividades", "1 actividad", "4 actividades"
 */
export function formatActivitiesCount(count: number): string {
  return pluralize(count, 'actividad', 'actividades');
}

/**
 * Formats space counts with grammatical agreement.
 * Examples: "0 espacios", "1 espacio", "3 espacios"
 */
export function formatSpacesCount(count: number): string {
  return pluralize(count, 'espacio', 'espacios');
}

/**
 * Formats day counts with grammatical agreement.
 * Examples: "0 días", "1 día", "7 días"
 */
export function formatDaysCount(count: number): string {
  return pluralize(count, 'día', 'días');
}

/**
 * Formats combined activities across spaces with grammatical agreement.
 * Examples:
 * - 0, 0: "0 actividades en 0 espacios"
 * - 1, 1: "1 actividad en 1 espacio"
 * - 2, 1: "2 actividades en 1 espacio"
 * - 5, 3: "5 actividades en 3 espacios"
 */
export function formatActivitiesInSpaces(activitiesCount: number, spacesCount: number): string {
  return `${formatActivitiesCount(activitiesCount)} en ${formatSpacesCount(spacesCount)}`;
}

/**
 * Formats combined activities across days with grammatical agreement.
 * Examples:
 * - 1, 1: "1 actividad en 1 día"
 * - 5, 2: "5 actividades en 2 días"
 */
export function formatActivitiesInDays(activitiesCount: number, daysCount: number): string {
  return `${formatActivitiesCount(activitiesCount)} en ${formatDaysCount(daysCount)}`;
}
