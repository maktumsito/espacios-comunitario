// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getStoredDraft, useReservationAutosave, STORAGE_PREFIX } from '../useReservationAutosave';
const base = {isOpen:true, formData:{id:'draft',responsable:'Vecino',descripcion:'Taller'},bookingMode:'single' as const,specificDates:[],selectedDays:[],recurrenceStartDate:'',recurrenceEndDate:'',useCustomSchedulesPerDate:false,dateSchedules:{},useCustomSchedulesPerDay:false,daySchedules:{},enableSingleSecondSpace:false,singleSecondSpace:'',singleSecondStartTime:'',singleSecondEndTime:'',onRestore:vi.fn()};
beforeEach(()=> { localStorage.clear(); vi.useFakeTimers(); });
afterEach(()=> { cleanup(); vi.useRealTimers(); });
it('saves recurrence-only and comment changes, and avoids duplicate writes',()=> {
  const {result,rerender}=renderHook(props=>useReservationAutosave(props),{initialProps:base});
  act(()=>vi.advanceTimersByTime(1));
  rerender({...base,formData:{...base.formData,comentarios:'Solo cambió el comentario'} as any,bookingMode:'pattern' as any,selectedDays:[1,3] as any});
  act(()=>vi.advanceTimersByTime(801));
  const draft=getStoredDraft(`${STORAGE_PREFIX}create`);
  expect(draft?.formData.comentarios).toBe('Solo cambió el comentario');
  expect(draft?.selectedDays).toEqual([1,3]);
  const storage=vi.spyOn(Storage.prototype,'setItem');
  act(()=>result.current.saveNow());
  expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
});
it('does not recreate a cleared successful draft from a pending timer or unload',()=> {
  const {result,rerender}=renderHook(props=>useReservationAutosave(props),{initialProps:base});
  act(()=>vi.advanceTimersByTime(1));
  rerender({...base,formData:{...base.formData,descripcion:'Actualizada'}});
  act(()=>result.current.clearDraft());
  act(()=> { vi.advanceTimersByTime(1000); window.dispatchEvent(new Event('beforeunload')); });
  expect(getStoredDraft(`${STORAGE_PREFIX}create`)).toBeNull();
});
