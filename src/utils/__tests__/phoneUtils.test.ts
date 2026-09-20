import { describe, it, expect } from 'vitest';
import { getPhoneContactActions } from '../phoneUtils';

describe('phoneUtils', () => {
  it('correctly processes Karen Soto phone number with country code', () => {
    const action = getPhoneContactActions('+56 9 2378 0490');
    expect(action).not.toBeNull();
    expect(action?.chileanDigits).toBe('56923780490');
    expect(action?.telHref).toBe('tel:+56923780490');
    expect(action?.waHref).toBe('https://wa.me/56923780490');
  });

  it('correctly adds country code 56 when starting without +56', () => {
    const action = getPhoneContactActions('923780490');
    expect(action).not.toBeNull();
    expect(action?.chileanDigits).toBe('56923780490');
    expect(action?.telHref).toBe('tel:+56923780490');
    expect(action?.waHref).toBe('https://wa.me/56923780490');
  });

  it('handles spaces, dashes and parentheses', () => {
    const action = getPhoneContactActions('+56 (9) 1234-5678');
    expect(action).not.toBeNull();
    expect(action?.chileanDigits).toBe('56912345678');
    expect(action?.telHref).toBe('tel:+56912345678');
    expect(action?.waHref).toBe('https://wa.me/56912345678');
  });

  it('returns null for empty, invalid, or too short input', () => {
    expect(getPhoneContactActions('')).toBeNull();
    expect(getPhoneContactActions(null)).toBeNull();
    expect(getPhoneContactActions('123')).toBeNull();
    expect(getPhoneContactActions('abc')).toBeNull();
  });
});
