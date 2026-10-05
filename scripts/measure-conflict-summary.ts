import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { detectAllConflicts, getConflictReservationIds } from '../src/utils/conflictDetector';
import { summarizeConflicts } from '../src/utils/conflictSummary';
import type { Reservation } from '../src/types';
const measurements=[];
for(const count of [500,2500,10000]) {
  const data: Reservation[]=Array.from({length:count},(_,i)=>({id:`sample-${i}`,fecha:`2026-10-${String(5+i%20).padStart(2,'0')}`,horaInicio:`${String(8+i%12).padStart(2,'0')}:00`,horaFin:`${String(9+i%12).padStart(2,'0')}:00`,espacio:['GIMNASIO','SALA 2','SALA 3','AUDITORIO'][i%4],responsable:'Vecino',descripcion:'Taller',tipoActividad:'Taller',actividadRecurrente:'No',estado:'activa'}));
  for(const phase of ['before','after']) {
    const fn=()=> {if(phase==='after')return summarizeConflicts(data);const conflicts=detectAllConflicts(data);return {count:conflicts.length,ids:getConflictReservationIds(data,conflicts)};};
    for(let i=0;i<3;i++)fn();const samples=[];
    for(let i=0;i<30;i++){const t=performance.now();fn();samples.push(performance.now()-t);}
    samples.sort((a,b)=>a-b);measurements.push({phase,count,medianMs:samples[15],p95Ms:samples[28],conflicts:fn().count,samples});
  }
}
writeFileSync('outputs/conflict-summary-performance.json',JSON.stringify({runs:30,warmups:3,measurements},null,2));console.log(measurements.map(({samples,...r})=>r));
