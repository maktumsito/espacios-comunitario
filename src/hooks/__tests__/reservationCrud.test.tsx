// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useReservationCrud, type UseReservationCrudProps } from '../useReservationCrud';
import type { Reservation } from '../../types';
const mocks=vi.hoisted(()=>({save:vi.fn(),audit:vi.fn(),notify:vi.fn()}));
vi.mock('../../services/reservationService',async original=> ({...(await original<any>()),saveReservation:mocks.save,saveReservationsBatch:mocks.save,commitReservationChanges:mocks.save}));
vi.mock('../../services/auditLogService',()=>({recordAuditEntry:mocks.audit,computeReservationDiff:()=>[]}));
vi.mock('../../services/notificationService',()=>({notifyTopamiento:mocks.notify,notifyImportantActivity:mocks.notify}));
const row:Reservation={id:'form',fecha:'2026-10-06',horaInicio:'10:00',horaFin:'11:00',espacio:'SALA 2',responsable:'Vecino',descripcion:'Taller',tipoActividad:'Taller',actividadRecurrente:'No',estado:'activa',version:0};
function props():UseReservationCrudProps {return {
  reservations:[],currentUser:{username:'local',name:'Local',role:'Administrador',avatarColor:'blue',initials:'L',canCreateReservations:true,canEditReservations:true,canDeleteReservations:true},selectedReservation:null,
  setReservations:vi.fn(),triggerSyncToast:vi.fn(),setIsReservationModalOpen:vi.fn(),setEditingReservation:vi.fn(),setSelectedReservation:vi.fn(),setIsDetailModalOpen:vi.fn(),setIsDeleteModalOpen:vi.fn(),setDeleteTargetReservation:vi.fn(),setConflictReportData:vi.fn(),setIsDuplicating:vi.fn(),setPrefillDate:vi.fn(),setPrefillSpace:vi.fn(),setPrefillStartTime:vi.fn(),setPrefillEndTime:vi.fn(),requireAuth:action=>action(),
};}
beforeEach(()=> {localStorage.clear();vi.clearAllMocks();mocks.audit.mockResolvedValue(undefined);});
afterEach(cleanup);
it('retains the form until confirmation and rejects a second submit',async()=> {
  let finish:(value:any)=>void=()=>{};mocks.save.mockReturnValue(new Promise(resolve=>finish=resolve));
  const p=props();const {result}=renderHook(()=>useReservationCrud(p));let pending:Promise<boolean>;
  act(()=> {pending=result.current.handleCreateOrUpdate(row);});
  expect(p.setReservations).not.toHaveBeenCalled();expect(p.setIsReservationModalOpen).not.toHaveBeenCalled();
  await expect(result.current.handleCreateOrUpdate(row)).resolves.toBe(false);expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async()=>{finish({reservations:[{...row,version:1}],deletedIds:[],confirmedIds:[row.id],pendingIds:[]});expect(await pending!).toBe(true);});
  expect(p.setIsReservationModalOpen).toHaveBeenCalledWith(false);
});
it('does not roll back the entire list after a failed save',async()=> {
  mocks.save.mockRejectedValue(new Error('permission denied'));const p=props();const {result}=renderHook(()=>useReservationCrud(p));
  await act(async()=>expect(await result.current.handleCreateOrUpdate(row)).toBe(false));
  expect(p.setReservations).not.toHaveBeenCalled();expect(p.setIsReservationModalOpen).not.toHaveBeenCalled();
});
it('keeps confirmation successful when later audit or notification fails',async()=> {
  mocks.save.mockResolvedValue({reservations:[{...row,version:1}],deletedIds:[],confirmedIds:[row.id],pendingIds:[]});mocks.audit.mockRejectedValue(new Error('audit failed'));mocks.notify.mockImplementation(()=> {throw new Error('notification failed');});
  const p=props();const {result}=renderHook(()=>useReservationCrud(p));
  await act(async()=>expect(await result.current.handleCreateOrUpdate({...row,importante:'Sí'})).toBe(true));
  expect(p.setIsReservationModalOpen).toHaveBeenCalledWith(false);
  expect(p.setReservations).toHaveBeenCalledTimes(1);
});
