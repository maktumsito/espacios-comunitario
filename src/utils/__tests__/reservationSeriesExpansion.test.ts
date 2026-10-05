import { describe, it, expect } from 'vitest';
import { Reservation, BatchUpdateInfo } from '../../types';
import { detectBatchConflicts } from '../conflictDetector';

describe('Reservation Series Expansion & Date Extension Suite', () => {
  const existingSeries: Reservation[] = [
    {
      id: 'RSV_REC_01',
      fecha: '2026-10-05',
      horaInicio: '10:00',
      horaFin: '11:00',
      espacio: 'GIMNASIO',
      tipoActividad: 'TALLER CCD',
      responsable: 'Profesor Carlos',
      actividadRecurrente: 'Sí',
      serieRecurrente: 'SER_CCD_100',
      recurrenteId: 'SER_CCD_100',
      indiceEnSerie: 1,
      totalEnSerie: 3,
      fechaInicioRecurrencia: '2026-10-05',
      fechaFinRecurrencia: '2026-10-19',
      diasSemana: 'lunes',
      tipoRecurrencia: 'semanal',
      descripcion: 'Taller de Yoga'
    },
    {
      id: 'RSV_REC_02',
      fecha: '2026-10-12',
      horaInicio: '10:00',
      horaFin: '11:00',
      espacio: 'GIMNASIO',
      tipoActividad: 'TALLER CCD',
      responsable: 'Profesor Carlos',
      actividadRecurrente: 'Sí',
      serieRecurrente: 'SER_CCD_100',
      recurrenteId: 'SER_CCD_100',
      indiceEnSerie: 2,
      totalEnSerie: 3,
      fechaInicioRecurrencia: '2026-10-05',
      fechaFinRecurrencia: '2026-10-19',
      diasSemana: 'lunes',
      tipoRecurrencia: 'semanal',
      descripcion: 'Taller de Yoga'
    },
    {
      id: 'RSV_REC_03',
      fecha: '2026-10-19',
      horaInicio: '10:00',
      horaFin: '11:00',
      espacio: 'GIMNASIO',
      tipoActividad: 'TALLER CCD',
      responsable: 'Profesor Carlos',
      actividadRecurrente: 'Sí',
      serieRecurrente: 'SER_CCD_100',
      recurrenteId: 'SER_CCD_100',
      indiceEnSerie: 3,
      totalEnSerie: 3,
      fechaInicioRecurrencia: '2026-10-05',
      fechaFinRecurrencia: '2026-10-19',
      diasSemana: 'lunes',
      tipoRecurrencia: 'semanal',
      descripcion: 'Taller de Yoga'
    }
  ];

  it('detects no conflicts against its own series when expanding dates', () => {
    // Target expanded dates: Oct 5, Oct 12, Oct 19, Oct 26, Nov 2
    const expandedCandidateList: Reservation[] = [
      ...existingSeries.map((s) => ({ ...s, descripcion: 'Taller de Yoga Avanzado' })),
      {
        id: 'RSV_EXPANDED_04',
        fecha: '2026-10-26',
        horaInicio: '10:00',
        horaFin: '11:00',
        espacio: 'GIMNASIO',
        tipoActividad: 'TALLER CCD',
        responsable: 'Profesor Carlos',
        actividadRecurrente: 'Sí',
        serieRecurrente: 'SER_CCD_100',
        recurrenteId: 'SER_CCD_100',
        descripcion: 'Taller de Yoga Avanzado'
      },
      {
        id: 'RSV_EXPANDED_05',
        fecha: '2026-11-02',
        horaInicio: '10:00',
        horaFin: '11:00',
        espacio: 'GIMNASIO',
        tipoActividad: 'TALLER CCD',
        responsable: 'Profesor Carlos',
        actividadRecurrente: 'Sí',
        serieRecurrente: 'SER_CCD_100',
        recurrenteId: 'SER_CCD_100',
        descripcion: 'Taller de Yoga Avanzado'
      }
    ];

    const affectedExistingIds = new Set(existingSeries.map((s) => s.id));
    const conflicts = detectBatchConflicts(
      expandedCandidateList,
      existingSeries,
      affectedExistingIds,
      'SER_CCD_100'
    );

    expect(conflicts).toHaveLength(0);
  });

  it('detects true external conflicts on newly expanded dates', () => {
    const externalReservation: Reservation = {
      id: 'RSV_OTHER_EXTERNAL',
      fecha: '2026-11-02',
      horaInicio: '10:30',
      horaFin: '12:00',
      espacio: 'GIMNASIO',
      tipoActividad: 'TORNEO EXTERNO',
      responsable: 'Club Deportivo',
      descripcion: 'Torneo'
    };

    const databaseWithExternal = [...existingSeries, externalReservation];

    const expandedCandidateList: Reservation[] = [
      ...existingSeries,
      {
        id: 'RSV_EXPANDED_04',
        fecha: '2026-10-26',
        horaInicio: '10:00',
        horaFin: '11:00',
        espacio: 'GIMNASIO',
        tipoActividad: 'TALLER CCD',
        responsable: 'Profesor Carlos',
        actividadRecurrente: 'Sí',
        serieRecurrente: 'SER_CCD_100',
        recurrenteId: 'SER_CCD_100'
      },
      {
        id: 'RSV_EXPANDED_05',
        fecha: '2026-11-02',
        horaInicio: '10:00',
        horaFin: '11:00',
        espacio: 'GIMNASIO',
        tipoActividad: 'TALLER CCD',
        responsable: 'Profesor Carlos',
        actividadRecurrente: 'Sí',
        serieRecurrente: 'SER_CCD_100',
        recurrenteId: 'SER_CCD_100'
      }
    ];

    const affectedExistingIds = new Set(existingSeries.map((s) => s.id));
    const conflicts = detectBatchConflicts(
      expandedCandidateList,
      databaseWithExternal,
      affectedExistingIds,
      'SER_CCD_100'
    );

    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].fecha).toBe('2026-11-02');
    expect(conflicts[0].conflictingWith?.id).toBe('RSV_OTHER_EXTERNAL');
  });

  it('generates coherent BatchUpdateInfo with preserved and new IDs, and synchronized indices', () => {
    // Simulate expanding series from 3 sessions to 5 sessions
    const targetDates = [
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
      '2026-11-02'
    ];

    const existingMap = new Map<string, Reservation>();
    existingSeries.forEach((r) => existingMap.set(r.fecha, r));

    const updatedList: Reservation[] = targetDates.map((dateStr, idx) => {
      const match = existingMap.get(dateStr);
      if (match) {
        return {
          ...match,
          descripcion: 'Actualizado yoga',
          indiceEnSerie: idx + 1,
          totalEnSerie: targetDates.length,
          fechaInicioRecurrencia: targetDates[0],
          fechaFinRecurrencia: targetDates[targetDates.length - 1]
        };
      }
      return {
        id: `RSV_NEW_${idx + 1}`,
        fecha: dateStr,
        horaInicio: '10:00',
        horaFin: '11:00',
        espacio: 'GIMNASIO',
        tipoActividad: 'TALLER CCD',
        responsable: 'Profesor Carlos',
        descripcion: 'Actualizado yoga',
        actividadRecurrente: 'Sí',
        serieRecurrente: 'SER_CCD_100',
        recurrenteId: 'SER_CCD_100',
        indiceEnSerie: idx + 1,
        totalEnSerie: targetDates.length,
        fechaInicioRecurrencia: targetDates[0],
        fechaFinRecurrencia: targetDates[targetDates.length - 1]
      };
    });

    const batchInfo: BatchUpdateInfo = {
      scope: 'series',
      updatedReservations: updatedList,
      affectedIds: updatedList.map((r) => r.id),
      description: `Actualizadas ${updatedList.length} reservas (Toda la serie)`
    };

    expect(batchInfo.updatedReservations).toHaveLength(5);
    // First 3 preserve original IDs
    expect(batchInfo.updatedReservations[0].id).toBe('RSV_REC_01');
    expect(batchInfo.updatedReservations[1].id).toBe('RSV_REC_02');
    expect(batchInfo.updatedReservations[2].id).toBe('RSV_REC_03');
    // Last 2 are new occurrences
    expect(batchInfo.updatedReservations[3].id).toBe('RSV_NEW_4');
    expect(batchInfo.updatedReservations[4].id).toBe('RSV_NEW_5');

    // All share consistent serieRecurrente, indices, and updated total
    batchInfo.updatedReservations.forEach((r, idx) => {
      expect(r.serieRecurrente).toBe('SER_CCD_100');
      expect(r.totalEnSerie).toBe(5);
      expect(r.indiceEnSerie).toBe(idx + 1);
      expect(r.fechaFinRecurrencia).toBe('2026-11-02');
    });
  });
});
