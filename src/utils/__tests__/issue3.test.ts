import { describe, it, expect } from 'vitest';
import { INITIAL_RESERVATIONS } from '../../data/initialData';
import { clampAndFixCalendarDate } from '../validationUtils';

describe('Check INITIAL_RESERVATIONS date filtering', () => {
  it('checks date range filtering', async () => {
    console.log('Total INITIAL_RESERVATIONS:', INITIAL_RESERVATIONS.length);
    const minDate = INITIAL_RESERVATIONS.reduce((min, r) => r.fecha < min ? r.fecha : min, '9999-99-99');
    const maxDate = INITIAL_RESERVATIONS.reduce((max, r) => r.fecha > max ? r.fecha : max, '0000-00-00');
    console.log('Min fecha:', minDate, 'Max fecha:', maxDate);

    const formats = new Set<string>();
    INITIAL_RESERVATIONS.forEach(r => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) formats.add('YYYY-MM-DD');
      else if (/^\d{2}-\d{2}-\d{4}$/.test(r.fecha)) formats.add('DD-MM-YYYY');
      else formats.add('OTHER: ' + r.fecha);
    });
    console.log('Date formats found:', Array.from(formats));

    console.log('clampAndFix("2027"):', clampAndFixCalendarDate('2027'));
    console.log('clampAndFix("2027-01-01"):', clampAndFixCalendarDate('2027-01-01'));

    // Test with fechaDesde = '2027-01-01'
    const res1 = INITIAL_RESERVATIONS.filter(r => r.fecha >= '2027-01-01');
    console.log('Reservations with fecha >= 2027-01-01:', res1.length);

    // Test with fechaDesde = '2027'
    const res2 = INITIAL_RESERVATIONS.filter(r => r.fecha >= '2027');
    console.log('Reservations with fecha >= 2027:', res2.length);

    // Test with fechaHasta = '2024-12-31'
    const res3 = INITIAL_RESERVATIONS.filter(r => r.fecha <= '2024-12-31');
    console.log('Reservations with fecha <= 2024-12-31:', res3.length);

    const { getFuzzyMatchIds } = await import('../fuzzySearch');
    const fuzzyIds = getFuzzyMatchIds(INITIAL_RESERVATIONS, '2027');
    console.log('fuzzyIds for "2027":', fuzzyIds.size);

    // Test date matching in reservations
    const matches2027 = INITIAL_RESERVATIONS.filter(r => (r.fecha || '').includes('2027'));
    console.log('Reservations with fecha including 2027:', matches2027.length);

    const matches2026 = INITIAL_RESERVATIONS.filter(r => (r.fecha || '').includes('2026'));
    console.log('Reservations with fecha including 2026:', matches2026.length);
  });
});

