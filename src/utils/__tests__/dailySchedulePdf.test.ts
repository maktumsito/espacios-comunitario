import { describe, expect, it } from 'vitest';
import type { Reservation } from '../../types';
import { generateDailyPdfsForDates, generateDailySchedulePdf } from '../dailySchedulePdf';

const booking = (id: string, fecha = '2026-10-01'): Reservation => ({
  id, fecha, horaInicio: '09:00', horaFin: '10:00', espacio: 'SALA 2', responsable: 'Ana Pérez',
  tipoActividad: 'Taller', descripcion: id, actividadRecurrente: 'No', importante: 'Sí'
});

describe('Daily landscape PDF attachments', () => {
  it('generates one independent folio landscape PDF per unique day without leaking important activities', async () => {
    const items = await generateDailyPdfsForDates(['2026-10-02', '2026-10-01', '2026-10-01'], [
      booking('ONLY_THURSDAY'), booking('ONLY_FRIDAY', '2026-10-02'),
      { ...booking('CANCELLED'), estado: 'Cancelada' }
    ], { include3DaysImportant: true });
    expect(items.map(item => item.date)).toEqual(['2026-10-01', '2026-10-02']);
    for (const item of items) {
      expect(item.activitiesCount).toBe(1);
      expect(item.doc.internal.pageSize.getWidth()).toBeCloseTo(330.2, 1);
      expect(item.doc.internal.pageSize.getHeight()).toBeCloseTo(215.9, 1);
      expect(item.doc.getNumberOfPages()).toBe(1);
      const pdf = item.doc.output();
      expect(pdf).toContain(item.date === '2026-10-01' ? 'ONLY_THURSDAY' : 'ONLY_FRIDAY');
      expect(pdf).not.toContain(item.date === '2026-10-01' ? 'ONLY_FRIDAY' : 'ONLY_THURSDAY');
      expect(pdf).not.toContain('CANCELLED');
    }
  });

  it('uses the available height for sparse schedules and keeps dense schedules readable', async () => {
    const sparse = await generateDailySchedulePdf({ dateStr: '2026-10-01', reservations: [booking('sparse')] });
    const table = (sparse as typeof sparse & { lastAutoTable: { finalY: number } }).lastAutoTable;
    expect(table.finalY).toBeGreaterThan(195);
    expect(table.finalY).toBeLessThan(202);
    const dense = await generateDailySchedulePdf({ dateStr: '2026-10-01', reservations: Array.from({ length: 45 }, (_, i) => ({
      ...booking(`ROW_${i}`), descripcion: `ROW_${i} ` + 'Detalle de actividad y equipamiento. '.repeat(8)
    })) });
    expect(dense.getNumberOfPages()).toBeGreaterThan(1);
    expect(dense.output()).toContain('ROW_44');
  });
});
