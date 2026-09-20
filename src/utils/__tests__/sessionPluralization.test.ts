import { describe, it, expect } from 'vitest';
import { formatSessionCounts } from '../../components/AdminRecurringView';
import { checkLoanScheduleLimit, EXTENSION_AUTH_KEY } from '../validationUtils';

describe('sessionPluralization', () => {
  it('formats singular session count correctly: "1 sesión: 1 futura, 0 pasadas"', () => {
    const result = formatSessionCounts(1, 1, 0);
    expect(result).toBe('(1 sesión: 1 futura, 0 pasadas)');
  });

  it('formats singular pasada correctly: "1 sesión: 0 futuras, 1 pasada"', () => {
    const result = formatSessionCounts(1, 0, 1);
    expect(result).toBe('(1 sesión: 0 futuras, 1 pasada)');
  });

  it('formats plural session counts correctly: "5 sesiones: 3 futuras, 2 pasadas"', () => {
    const result = formatSessionCounts(5, 3, 2);
    expect(result).toBe('(5 sesiones: 3 futuras, 2 pasadas)');
  });
});

describe('loanScheduleLimitValidation', () => {
  it('flags 08:00 as requiring authorization (before 08:30)', () => {
    const result = checkLoanScheduleLimit('08:00', '10:00');
    expect(result.requiresAuthorization).toBe(true);
    expect(result.isOutsideRegularHours).toBe(true);
    expect(EXTENSION_AUTH_KEY).toBe('ccd2026');
  });

  it('does not flag normal hours such as 09:00 to 11:00', () => {
    const result = checkLoanScheduleLimit('09:00', '11:00');
    expect(result.requiresAuthorization).toBe(false);
    expect(result.isOutsideRegularHours).toBe(false);
  });
});
