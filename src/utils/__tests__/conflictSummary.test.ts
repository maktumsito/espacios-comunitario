import { expect, it } from 'vitest';
import { summarizeConflicts } from '../conflictSummary';
import { detectAllConflicts, getConflictReservationIds } from '../conflictDetector';
import type { Reservation } from '../../types';
it('matches all detailed pairs and participants over mixed intervals, inactive states and overnight rooms',()=> {
  for(let seed=0;seed<20;seed++) {
    const rows: Reservation[]=Array.from({length:150},(_,i)=>({id:`${i}`,fecha:`2026-10-${String(5+i%3).padStart(2,'0')}`,horaInicio:`${String(8+(i*7+seed)%15).padStart(2,'0')}:00`,horaFin:`${String(9+(i*7+seed)%15).padStart(2,'0')}:00`,espacio:`SALA ${i%4}`,responsable:'Vecino',descripcion:'Prueba',tipoActividad:'Taller',actividadRecurrente:'No',estado:i%13===0?'cancelada':'activa',terminaDiaSiguiente:i%17===0}));
    const detailed=detectAllConflicts(rows);const summary=summarizeConflicts(rows);
    expect(summary.count).toBe(detailed.length);
    expect([...summary.ids].sort()).toEqual([...getConflictReservationIds(rows,detailed)].sort());
    rows[0]={...rows[0],espacio:'SALA 1 / SALA 2',estado:'activa'};
    expect(summarizeConflicts(rows).count).toBe(detectAllConflicts(rows).length);
  }
});
