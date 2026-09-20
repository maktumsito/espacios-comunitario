import { format, parseISO } from 'date-fns';

// ==========================================
// CONSTANTS & FORMATS
// ==========================================

const TARGET_DATE_FORMAT = 'dd-MM-yyyy';

const DD_MM_YYYY_PATTERN = /^\d{2}-\d{2}-\d{4}$/;
const YYYY_MM_DD_PATTERN = /^\d{4}-\d{2}-\d{2}/;

/**
 * Formats any date input (ISO string, standard date string, epoch number or Date instance)
 * into a standardized "dd-MM-yyyy" format (e.g., "27-08-2026").
 *
 * @param dateValue - The input date to format.
 * @returns Standardized "dd-MM-yyyy" string, or empty string if input is invalid/empty.
 */
export function formatDateDDMMYYYY(dateValue: string | number | Date | null | undefined): string {
  if (!dateValue) {
    return '';
  }

  // Handle native Date instances directly
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? '' : format(dateValue, TARGET_DATE_FORMAT);
  }

  // Handle epoch timestamps
  if (typeof dateValue === 'number') {
    const timestampDate = new Date(dateValue);
    return isNaN(timestampDate.getTime()) ? '' : format(timestampDate, TARGET_DATE_FORMAT);
  }

  const normalizedInput = String(dateValue).trim();
  if (!normalizedInput) {
    return '';
  }

  // Guard: Return as-is if already in target dd-MM-yyyy format
  if (DD_MM_YYYY_PATTERN.test(normalizedInput)) {
    return normalizedInput;
  }

  // Fast string transposition for ISO dates without timezone drift
  if (YYYY_MM_DD_PATTERN.test(normalizedInput)) {
    const dateSegment = normalizedInput.split('T')[0];
    const [year, month, day] = dateSegment.split('-');
    if (year && month && day) {
      return `${day}-${month}-${year}`;
    }
  }

  // Fallback parsing via date-fns parseISO
  try {
    const parsedIso = parseISO(normalizedInput);
    if (!isNaN(parsedIso.getTime())) {
      return format(parsedIso, TARGET_DATE_FORMAT);
    }

    const fallbackDate = new Date(normalizedInput);
    if (!isNaN(fallbackDate.getTime())) {
      return format(fallbackDate, TARGET_DATE_FORMAT);
    }
  } catch {
    // Non-parsable string returns original input safely
    return normalizedInput;
  }

  return normalizedInput;
}

export function parseDateToNoon(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.split('T')[0].trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 12, 0, 0);
    }
  }
  try {
    const parsed = parseISO(clean);
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
  } catch {
    return new Date();
  }
}

export function formatDateYYYYMMDD(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * from a 'YYYY-MM-DD' date string safely without timezone drift.
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  if (!dateStr) return 1;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 12, 0, 0).getDay();
    }
  }
  try {
    return parseISO(dateStr).getDay();
  } catch {
    return 1;
  }
}

/**
 * Generates an array of 'YYYY-MM-DD' dates for a recurrence pattern.
 * Boundary Guarantee: The end date is strictly inclusive (currDate <= endDate)
 * if it coincides with one of the selected weekdays.
 *
 * @param startDateStr - Recurrence start date (YYYY-MM-DD)
 * @param endDateStr - Recurrence end date (YYYY-MM-DD)
 * @param selectedDays - Array of day numbers (0 = Sun, 1 = Mon, ..., 6 = Sat)
 * @param maxOccurrences - Safety cap for returned matches (default: 500)
 */
export function generateRecurrenceDates(
  startDateStr: string,
  endDateStr: string,
  selectedDays: number[],
  maxOccurrences: number = 500
): string[] {
  if (!startDateStr || !endDateStr || !Array.isArray(selectedDays) || selectedDays.length === 0) {
    return [];
  }

  const cleanStart = startDateStr.split('T')[0].trim();
  const cleanEnd = endDateStr.split('T')[0].trim();

  // Safety check: end date cannot precede start date
  if (cleanEnd < cleanStart) {
    return [];
  }

  const startParts = cleanStart.split('-').map(Number);
  if (startParts.length !== 3 || startParts.some(isNaN)) {
    return [];
  }

  // Anchor at 12:00:00 (noon) to completely eliminate Daylight Saving Time hour shifts
  const [sY, sM, sD] = startParts;
  const cursor = new Date(sY, sM - 1, sD, 12, 0, 0);

  const matchedDates: string[] = [];
  let daysIterated = 0;
  const MAX_DAYS_SCAN = 1825; // 5 calendar years safety ceiling

  while (daysIterated < MAX_DAYS_SCAN && matchedDates.length < maxOccurrences) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const currStr = `${y}-${m}-${d}`;

    // STRICT INCLUSIVE BOUNDARY: currStr <= cleanEnd
    if (currStr > cleanEnd) {
      break;
    }

    const dayNum = cursor.getDay();
    if (selectedDays.includes(dayNum)) {
      matchedDates.push(currStr);
    }

    // Advance 1 calendar day
    cursor.setDate(cursor.getDate() + 1);
    daysIterated++;
  }

  return matchedDates;
}

/**
 * Formats a Date into YYYY-MM-DD in Chilean timezone (America/Santiago),
 * preventing unwanted next-day date shifts after ~20:00/21:00 local time.
 */
export function getChileLocalDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
