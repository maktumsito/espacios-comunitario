import type { Reservation } from '../types';
import { detectAllConflicts, getConflictReservationIds, getTimeIntervalsForReservation, getConstituentSpaces, isDateExemptFromConflicts, isReservationActiveForAvailability } from './conflictDetector';
import { getDeletedIds } from './deletedReservationsStore';

/** Counts room conflicts and marks involved reservations without creating a
 * potentially enormous object for every pair. Detailed reports remain on demand. */
export function summarizeConflicts(reservations: readonly Reservation[]): { count: number; ids: Set<string> } {
  const deleted = getDeletedIds();
  const active = reservations.filter(r=>isReservationActiveForAvailability(r,deleted)&&!isDateExemptFromConflicts(r.fecha));
  // Compound rooms can report the same pair through several rooms. Preserve the
  // existing deduplication semantics for that less frequent representation.
  if (active.some(r=>getConstituentSpaces(r.espacio).length>1) || new Set(active.map(r=>r.id)).size!==active.length) {
    const detailed=detectAllConflicts(active);
    return {count:detailed.length,ids:getConflictReservationIds(active,detailed)};
  }
  const groups=new Map<string,{id:string;start:number;end:number}[]>();
  for(const r of active) for(const slot of getTimeIntervalsForReservation(r)) {
    const room=getConstituentSpaces(r.espacio)[0]; if(!room)continue;
    const key=`${slot.date}|${room}`;
    const list=groups.get(key)||[]; list.push({id:r.id,start:slot.startMin,end:slot.endMin}); groups.set(key,list);
  }
  const ids=new Set<string>();let count=0;
  for(const list of groups.values()) {
    list.sort((a,b)=>a.start-b.start);
    const heap: {id:string;end:number}[]=[];
    const unmarked=new Set<string>();
    const pop=()=> {
      const first=heap[0],last=heap.pop()!;
      if(heap.length) {heap[0]=last;let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].end<heap[c].end)c++;if(heap[i].end<=heap[c].end)break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}
      unmarked.delete(first.id);
    };
    for(const item of list) {
      while(heap.length&&heap[0].end<=item.start)pop();
      count+=heap.length;
      if(heap.length) {ids.add(item.id);unmarked.forEach(id=>ids.add(id));unmarked.clear();}
      else if(!ids.has(item.id))unmarked.add(item.id);
      heap.push({id:item.id,end:item.end});let i=heap.length-1;
      while(i>0){const p=(i-1)>>1;if(heap[p].end<=heap[i].end)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}
    }
  }
  return {count,ids};
}
