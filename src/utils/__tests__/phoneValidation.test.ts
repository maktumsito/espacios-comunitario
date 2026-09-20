import { describe, it, expect } from 'vitest';
import { validateAndFormatChileanPhone } from '../validationUtils';

describe('validateAndFormatChileanPhone', () => {
  it('validates 9-digit Chilean mobile number starting with 9', () => {
    const result = validateAndFormatChileanPhone('912345678');
    expect(result.isValid).toBe(true);
    expect(result.cleanDigits).toBe('912345678');
    expect(result.telUrl).toBe('tel:+56912345678');
    expect(result.whatsappUrl).toBe('https://wa.me/56912345678');
  });

  it('validates full international Chilean number with +56', () => {
    const result = validateAndFormatChileanPhone('+56 9 8765 4321');
    expect(result.isValid).toBe(true);
    expect(result.cleanDigits).toBe('987654321');
    expect(result.telUrl).toBe('tel:+56987654321');
    expect(result.whatsappUrl).toBe('https://wa.me/56987654321');
  });

  it('upgrades legacy 8-digit mobile numbers', () => {
    const result = validateAndFormatChileanPhone('87654321');
    expect(result.isValid).toBe(true);
    expect(result.cleanDigits).toBe('987654321');
    expect(result.telUrl).toBe('tel:+56987654321');
  });

  it('rejects short or incomplete phone numbers', () => {
    const result = validateAndFormatChileanPhone('12345');
    expect(result.isValid).toBe(false);
    expect(result.telUrl).toBe('');
    expect(result.whatsappUrl).toBe('');
    expect(result.error).toBeDefined();
  });

  it('rejects empty or null strings safely', () => {
    expect(validateAndFormatChileanPhone('').isValid).toBe(false);
    expect(validateAndFormatChileanPhone(undefined).isValid).toBe(false);
  });
});
