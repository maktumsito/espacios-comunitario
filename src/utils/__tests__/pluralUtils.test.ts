import { describe, it, expect } from 'vitest';
import {
  pluralize,
  formatActivitiesCount,
  formatSpacesCount,
  formatDaysCount,
  formatActivitiesInSpaces,
  formatActivitiesInDays
} from '../pluralUtils';

describe('pluralUtils', () => {
  describe('pluralize', () => {
    it('handles count 0 with plural form in Spanish', () => {
      expect(pluralize(0, 'actividad', 'actividades')).toBe('0 actividades');
      expect(pluralize(0, 'espacio', 'espacios')).toBe('0 espacios');
    });

    it('handles count 1 with singular form', () => {
      expect(pluralize(1, 'actividad', 'actividades')).toBe('1 actividad');
      expect(pluralize(1, 'espacio', 'espacios')).toBe('1 espacio');
      expect(pluralize(1, 'día', 'días')).toBe('1 día');
    });

    it('handles count 2 and greater with plural form', () => {
      expect(pluralize(2, 'actividad', 'actividades')).toBe('2 actividades');
      expect(pluralize(5, 'espacio', 'espacios')).toBe('5 espacios');
      expect(pluralize(10, 'día', 'días')).toBe('10 días');
    });

    it('handles edge cases safely (NaN, null, undefined)', () => {
      expect(pluralize(NaN as any, 'actividad', 'actividades')).toBe('0 actividades');
      expect(pluralize(undefined as any, 'espacio', 'espacios')).toBe('0 espacios');
    });
  });

  describe('formatActivitiesCount', () => {
    it('correctly formats 0, 1, and 2+ activities', () => {
      expect(formatActivitiesCount(0)).toBe('0 actividades');
      expect(formatActivitiesCount(1)).toBe('1 actividad');
      expect(formatActivitiesCount(2)).toBe('2 actividades');
      expect(formatActivitiesCount(45)).toBe('45 actividades');
    });
  });

  describe('formatSpacesCount', () => {
    it('correctly formats 0, 1, and 2+ spaces', () => {
      expect(formatSpacesCount(0)).toBe('0 espacios');
      expect(formatSpacesCount(1)).toBe('1 espacio');
      expect(formatSpacesCount(2)).toBe('2 espacios');
      expect(formatSpacesCount(6)).toBe('6 espacios');
    });
  });

  describe('formatDaysCount', () => {
    it('correctly formats 0, 1, and 2+ days', () => {
      expect(formatDaysCount(0)).toBe('0 días');
      expect(formatDaysCount(1)).toBe('1 día');
      expect(formatDaysCount(2)).toBe('2 días');
    });
  });

  describe('formatActivitiesInSpaces', () => {
    it('correctly combines singular and plural combinations', () => {
      expect(formatActivitiesInSpaces(0, 0)).toBe('0 actividades en 0 espacios');
      expect(formatActivitiesInSpaces(1, 1)).toBe('1 actividad en 1 espacio');
      expect(formatActivitiesInSpaces(2, 1)).toBe('2 actividades en 1 espacio');
      expect(formatActivitiesInSpaces(1, 2)).toBe('1 actividad en 2 espacios');
      expect(formatActivitiesInSpaces(8, 3)).toBe('8 actividades en 3 espacios');
    });
  });

  describe('formatActivitiesInDays', () => {
    it('correctly combines singular and plural combinations for days', () => {
      expect(formatActivitiesInDays(1, 1)).toBe('1 actividad en 1 día');
      expect(formatActivitiesInDays(3, 1)).toBe('3 actividades en 1 día');
      expect(formatActivitiesInDays(1, 2)).toBe('1 actividad en 2 días');
      expect(formatActivitiesInDays(5, 4)).toBe('5 actividades en 4 días');
    });
  });
});
