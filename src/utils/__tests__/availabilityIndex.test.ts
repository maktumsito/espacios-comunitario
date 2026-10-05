import { expect, it } from 'vitest';
import { buildAvailabilityIndex, getAvailabilityCandidates } from '../availabilityIndex';
import { checkSingleConflict } from '../conflictDetector';
import type { Reservation } from '../../types';
it('matches complete scans for compound rooms, overnight bookings, inactive and historical dates',()=> {
  const rows:Reservation[] = Array.from({length:1000},(_,i)=>({id:`indexed-${i}`,fecha:`2026-10-${String(5+i%20).padStart(2,'0')}`,horaInicio:i%5===0?'23:00':'10:00',horaFin:i%5===0?'01:00':'11:00',terminaDiaSiguiente:i%5===0,espacio:i%7===0?'SALA 2 / SALA 3':`SALA ${i%4}`,responsable:'Vecino',descripcion:'Taller',tipoActividad:'Taller',actividadRecurrente:'No',estado:i%13===0?'cancelada':'activa'}));
  const index=buildAvailabilityIndex(rows);
  for(const row of rows.slice(0,100)) {
    const candidate={...row,id:'candidate'};
    expect(checkSingleConflict(candidate,getAvailabilityCandidates(index,candidate)).map(r=>r.id).sort()).toEqual(checkSingleConflict(candidate,rows).map(r=>r.id).sort());
  }
});
