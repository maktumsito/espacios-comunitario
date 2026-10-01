import { describe, expect, it } from 'vitest';
import type { Reservation } from '../../types';
import { filterDatesToDispatchWeek, getSantiagoDateStr, selectDispatchReservations } from '../activityDispatchSelection';
import { calculateActivityDatesForDispatchDate } from '../../services/gmailDispatchService';

const reservation = (id: string, overrides: Partial<Reservation> = {}): Reservation => ({
  id, fecha: '2026-10-01', horaInicio: '09:00', horaFin: '10:00', espacio: 'SALA 2',
  responsable: 'Responsable', tipoActividad: 'Taller', descripcion: id, actividadRecurrente: 'No', ...overrides
});

describe('Weekly activity dispatch selection', () => {
  it('uses the Santiago date at UTC midnight and a Monday-Sunday week across months', () => {
    expect(getSantiagoDateStr(new Date('2026-10-02T01:00:00Z'))).toBe('2026-10-01');
    expect(filterDatesToDispatchWeek(['2026-09-27', '2026-09-28', '2026-10-04', '2026-10-05', '2026-10-04'], '2026-10-01'))
      .toEqual(['2026-09-28', '2026-10-04']);
  });

  it('intersects dates, types and explicit IDs, excluding inactive activities in any case', () => {
    const reservations = [
      reservation('selected'), reservation('unchecked'), reservation('next-week', { fecha: '2026-10-05' }),
      reservation('other-type', { tipoActividad: 'Deporte' }), reservation('cancelled', { estado: 'Cancelada' }),
      reservation('rejected', { estado: 'rechazada' }), reservation('deleted', { estado: 'Eliminada' })
    ];
    const result = selectDispatchReservations(reservations, {
      dates: ['2026-10-01', '2026-10-05'], referenceDate: '2026-10-01',
      filterMode: 'actividades_seleccionadas', selectedActivityTypes: [' taller '],
      selectedActivityIds: reservations.filter(r => r.id !== 'unchecked').map(r => r.id)
    });
    expect(result.map(r => r.id)).toEqual(['selected']);
  });

  it('keeps loans in the mixed mode even when their type is not selected', () => {
    const result = selectDispatchReservations([
      reservation('loan', { tipoPrestamo: 'Organización comunitaria' }), reservation('taller'),
      reservation('other', { tipoActividad: 'Deporte' })
    ], { dates: ['2026-10-01'], referenceDate: '2026-10-01', filterMode: 'prestamos_y_seleccionadas', selectedActivityTypes: ['Taller'] });
    expect(result.map(r => r.id)).toEqual(['loan', 'taller']);
  });

  it('never interprets an empty type or ID selection as all activities', () => {
    expect(selectDispatchReservations([reservation('a')], {
      dates: ['2026-10-01'], referenceDate: '2026-10-01', filterMode: 'actividades_seleccionadas', selectedActivityTypes: []
    })).toEqual([]);
    expect(selectDispatchReservations([reservation('a')], {
      dates: ['2026-10-01'], referenceDate: '2026-10-01', filterMode: 'todas', selectedActivityIds: []
    })).toEqual([]);
  });

  it('uses the current weekend on Sunday and configured weekdays within that cycle', () => {
    expect(calculateActivityDatesForDispatchDate('2026-10-04', 'fin_de_semana')).toEqual(['2026-10-03', '2026-10-04']);
    expect(calculateActivityDatesForDispatchDate('2026-10-01', 'dias_especificos', [1, 6, 0])).toEqual(['2026-09-28', '2026-10-03', '2026-10-04']);
    expect(calculateActivityDatesForDispatchDate('2026-10-01', 'dias_especificos', [])).toEqual([]);
    expect(calculateActivityDatesForDispatchDate('2026-10-04', 'siguiente_sabado')).toEqual(['2026-10-03']);
    expect(calculateActivityDatesForDispatchDate('2026-10-01', 'proxima_semana')).toEqual(calculateActivityDatesForDispatchDate('2026-10-01', 'semana_en_curso'));
  });
});
