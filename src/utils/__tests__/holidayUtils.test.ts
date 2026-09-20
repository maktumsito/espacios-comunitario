import { describe, it, expect } from 'vitest';
import { getChileanHolidays, isChileanHoliday } from '../holidayUtils';

describe('Chilean Holidays & Law 19.668 Tests', () => {
  it('correctly calculates moved holidays under Law 19.668 for San Pedro y San Pablo (June 29)', () => {
    // 2023: June 29 was Thursday -> moved to Monday June 26
    const holidays2023 = getChileanHolidays(2023);
    const sanPedro2023 = holidays2023.find((h) => h.name.includes('San Pedro y San Pablo'));
    expect(sanPedro2023).toBeDefined();
    expect(sanPedro2023?.date).toBe('2023-06-26');

    // 2024: June 29 was Saturday -> stays Saturday June 29
    const holidays2024 = getChileanHolidays(2024);
    const sanPedro2024 = holidays2024.find((h) => h.name.includes('San Pedro y San Pablo'));
    expect(sanPedro2024?.date).toBe('2024-06-29');

    // 2025: June 29 is Sunday -> stays Sunday June 29
    const holidays2025 = getChileanHolidays(2025);
    const sanPedro2025 = holidays2025.find((h) => h.name.includes('San Pedro y San Pablo'));
    expect(sanPedro2025?.date).toBe('2025-06-29');

    // 2026: June 29 is Monday -> stays Monday June 29
    const holidays2026 = getChileanHolidays(2026);
    const sanPedro2026 = holidays2026.find((h) => h.name.includes('San Pedro y San Pablo'));
    expect(sanPedro2026?.date).toBe('2026-06-29');
  });

  it('correctly calculates moved holidays under Law 19.668 for Encuentro de Dos Mundos (October 12)', () => {
    // 2023: October 12 was Thursday -> moved to Monday October 9
    const holidays2023 = getChileanHolidays(2023);
    const encuentro2023 = holidays2023.find((h) => h.name.includes('Encuentro de Dos Mundos'));
    expect(encuentro2023?.date).toBe('2023-10-09');

    // 2024: October 12 was Saturday -> stays Saturday October 12
    const holidays2024 = getChileanHolidays(2024);
    const encuentro2024 = holidays2024.find((h) => h.name.includes('Encuentro de Dos Mundos'));
    expect(encuentro2024?.date).toBe('2024-10-12');

    // 2025: October 12 is Sunday -> stays Sunday October 12
    const holidays2025 = getChileanHolidays(2025);
    const encuentro2025 = holidays2025.find((h) => h.name.includes('Encuentro de Dos Mundos'));
    expect(encuentro2025?.date).toBe('2025-10-12');

    // 2026: October 12 is Monday -> stays Monday October 12
    const holidays2026 = getChileanHolidays(2026);
    const encuentro2026 = holidays2026.find((h) => h.name.includes('Encuentro de Dos Mundos'));
    expect(encuentro2026?.date).toBe('2026-10-12');
  });

  it('recognizes New Year, Christmas, and Fiestas Patrias as holidays', () => {
    expect(isChileanHoliday('2026-01-01')).toBe(true);
    expect(isChileanHoliday('2026-09-18')).toBe(true);
    expect(isChileanHoliday('2026-09-19')).toBe(true);
    expect(isChileanHoliday('2026-12-25')).toBe(true);
  });
});
