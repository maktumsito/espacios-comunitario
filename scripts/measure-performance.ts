import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { buildReservationDateIndex } from '../src/utils/reservationIndex';
import { fuzzySearchReservations } from '../src/utils/fuzzySearch';
import { findReservationConflicts } from '../src/utils/conflictDetector';
import { validateReservationWithZod } from '../src/schemas/reservationSchema';
import { generateDailySchedulePdf } from '../src/utils/dailySchedulePdf';
import type { Reservation } from '../src/types';

const phase = process.argv[2] || 'after';
const results: object[] = [];
async function measure(name: string, count: number, fn: () => unknown | Promise<unknown>) {
  for (let i = 0; i < 3; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a,b) => a-b);
  results.push({ name, count, medianMs: samples[15], p95Ms: samples[28], samples });
}
for (const count of [500, 2500, 10000]) {
  const data: Reservation[] = Array.from({ length: count }, (_, i) => ({
    id: `sample-${i}`, fecha: `2026-10-${String(5 + i % 20).padStart(2, '0')}`,
    horaInicio: `${String(8 + i % 12).padStart(2, '0')}:00`,
    horaFin: `${String(9 + i % 12).padStart(2, '0')}:00`,
    espacio: ['GIMNASIO','SALA 2','SALA 3','AUDITORIO'][i%4],
    responsable: `Vecino González ${i}`, descripcion: `Taller comunitario ${i}`,
    tipoActividad: 'Taller', actividadRecurrente: 'No', estado: 'activa',
  }));
  const dense = data.map(r => ({ ...r, fecha: '2026-10-05' }));
  await measure('date-index', count, () => buildReservationDateIndex(data));
  await measure('dense-date-index', count, () => buildReservationDateIndex(dense));
  await measure('search', count, () => fuzzySearchReservations(data, 'gonzalez 123'));
  await measure('conflicts-50', count, () => findReservationConflicts(data.slice(0,50), data));
  await measure('validation', count, () => data.map(r => validateReservationWithZod(r)));
  await measure('pdf', count, () => generateDailySchedulePdf({ dateStr: '2026-10-05', reservations: data }));
}
writeFileSync(`outputs/${phase}-performance.json`, JSON.stringify({ phase, runtime: process.version, warmups: 3, runs: 30, results }, null, 2));
console.log(results);
