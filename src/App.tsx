import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Reservation, ViewMode, FilterState, isSingleDayMultiSpaceReservation, BatchUpdateInfo, SpaceRating } from './types';
import { normalizeSpaceName } from './data/spacesData';
import { isChileanHoliday } from './utils/holidayUtils';
import {
  saveReservation,
  saveReservationsBatch,
  deleteReservationById,
  deleteSeriesByRecurrenteId,
  seedAllToFirestore,
  deleteAllHolidayReservations,
  purgeExpiredScheduleSlots,
  getLocalCache
} from './services/reservationService';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { CalendarView } from './components/CalendarView';
import { DailyUsageView } from './components/DailyUsageView';
import { MobileAgendaView } from './components/MobileAgendaView';
import { getInitialViewMode, isMobileDevice, persistViewPreference } from './utils/deviceUtils';
import { ReservationDetailModal } from './components/ReservationDetailModal';
import {
  recordAuditEntry,
  computeReservationDiff
} from './services/auditLogService';
import { notifyImportantActivity } from './services/notificationService';
import { getFuzzyMatchIds } from './utils/fuzzySearch';
import { RevalidationBanner, CalendarSkeleton, TimelineSkeleton } from './components/common/LoadingSkeleton';

// Custom Hooks for Modular Architecture
import { useReservationsState } from './hooks/useReservationsState';
import { useReservationModals } from './hooks/useReservationModals';
import { useAdminConfig } from './hooks/useAdminConfig';
import { useRatingsState } from './hooks/useRatingsState';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useAuditLogs } from './hooks/useAuditLogs';
import { useSpaceBlocks } from './hooks/useSpaceBlocks';
import { ReservationModal } from './components/ReservationModal';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Code-split heavy views & modals with resilient lazyWithRetry to reduce initial bundle size and boost reliability
const SpaceDashboard = lazyWithRetry(
  () => import('./components/SpaceDashboard').then((m) => ({ default: m.SpaceDashboard })),
  'SpaceDashboard'
);
const ConflictsView = lazyWithRetry(
  () => import('./components/ConflictsView').then((m) => ({ default: m.ConflictsView })),
  'ConflictsView'
);
const AdminView = lazyWithRetry(
  () => import('./components/AdminView').then((m) => ({ default: m.AdminView || m.default })),
  'AdminView'
);
const RatingsDashboardView = lazyWithRetry(
  () => import('./components/RatingsDashboardView').then((m) => ({ default: m.RatingsDashboardView })),
  'RatingsDashboardView'
);
const AnalyticsView = lazyWithRetry(
  () => import('./components/AnalyticsView').then((m) => ({ default: m.AnalyticsView })),
  'AnalyticsView'
);
const MaintenanceDashboardView = lazyWithRetry(
  () => import('./components/MaintenanceDashboardView').then((m) => ({ default: m.MaintenanceDashboardView })),
  'MaintenanceDashboardView'
);
const ApplicantDirectoryView = lazyWithRetry(
  () => import('./components/ApplicantDirectoryView').then((m) => ({ default: m.ApplicantDirectoryView })),
  'ApplicantDirectoryView'
);
import { AppModalsContainer } from './components/AppModalsContainer';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { initGmailAuthListener } from './services/gmailDispatchService';
import {
  notifyTopamiento,
  checkTodayImportantActivities,
  getNotificationHistory,
  initNotificationListeners,
  AppNotificationItem
} from './services/notificationService';
import {
  detectAllConflicts,
  getConflictReservationIds,
  detectBatchConflicts,
  formatConflictMessage
} from './utils/conflictDetector';
import { addWeeks, format, parseISO } from 'date-fns';
import {
  AuthUser,
  getStoredAuthUser,
  saveAuthUser,
  clearAuthUser,
  getAllAuthorizedUsers,
  isCoordinatorOrAdmin
} from './services/authService';
import { LoginScreen } from './components/LoginScreen';
import { AppFooter } from './components/AppFooter';
import { Wifi, WifiOff, Clock, ShieldCheck, Filter, RotateCcw } from 'lucide-react';
import { checkAndRunScheduledBackup } from './services/backupService';
import { getActiveDraftSummary, removeStoredDraft, ActiveDraftSummary } from './hooks/useReservationAutosave';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredAuthUser());
  const [currentView, setCurrentView] = useState<ViewMode>(() => getInitialViewMode());
  const [adminSubTab, setAdminSubTab] = useState<'spaces' | 'activities' | 'equipment' | 'users' | 'maintenance' | 'applicants' | 'gmail' | 'recurring'>('spaces');
  const [selectedDailyDate, setSelectedDailyDate] = useState<Date>(() => new Date());

  // 1. Network Status Hook
  const { isOnline, showReconnectedAlert } = useNetworkStatus();

  // 2. Reservations State Hook
  const {
    reservations,
    setReservations,
    isFirebaseConnected,
    setIsFirebaseConnected,
    isFirebaseSyncing,
    setIsFirebaseSyncing,
    lastSyncTime,
    setLastSyncTime,
    isInitialLoading,
    syncStatusToast,
    setSyncStatusToast,
    triggerSyncToast
  } = useReservationsState();

  // 3. Modals & Dialogs Hook
  const {
    isReservationModalOpen,
    setIsReservationModalOpen,
    isDetailModalOpen,
    setIsDetailModalOpen,
    isImportExportModalOpen,
    setIsImportExportModalOpen,
    isAuditLogOpen,
    setIsAuditLogOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    isPendingDeletionsModalOpen,
    setIsPendingDeletionsModalOpen,
    isChangePasswordOpen,
    setIsChangePasswordOpen,
    isPasswordPromptOpen,
    setIsPasswordPromptOpen,
    isRatingModalOpen,
    setIsRatingModalOpen,
    isGlobalPrintModalOpen,
    setIsGlobalPrintModalOpen,
    isNotificationCenterOpen,
    setIsNotificationCenterOpen,
    selectedReservation,
    setSelectedReservation,
    editingReservation,
    setEditingReservation,
    isDuplicating,
    setIsDuplicating,
    deleteTargetReservation,
    setDeleteTargetReservation,
    ratingTargetReservation,
    setRatingTargetReservation,
    editingRating,
    setEditingRating,
    passwordTargetUser,
    setPasswordTargetUser,
    globalPrintInitialDate,
    setGlobalPrintInitialDate,
    conflictReportData,
    setConflictReportData,
    pendingAuthAction,
    setPendingAuthAction,
    authActionDescription,
    setAuthActionDescription,
    prefillDate,
    setPrefillDate,
    prefillSpace,
    setPrefillSpace,
    prefillStartTime,
    setPrefillStartTime,
    prefillEndTime,
    setPrefillEndTime,
    prefillResponsable,
    setPrefillResponsable,
    prefillRut,
    setPrefillRut,
    prefillPhone,
    setPrefillPhone,
    prefillEmail,
    setPrefillEmail,
    closeReservationModal,
    openCreateModal,
    isGmailDispatchModalOpen,
    setIsGmailDispatchModalOpen,
    gmailDispatchInitialDate,
    setGmailDispatchInitialDate,
    openGmailDispatchModal
  } = useReservationModals();

  // 4. Admin Configuration Hook
  const {
    spaces,
    setSpaces,
    loanTypes,
    setLoanTypes,
    activityTypes,
    setActivityTypes,
    equipment,
    setEquipment,
    userAccounts,
    setUserAccounts,
    handleSaveSpace,
    handleDeleteSpace,
    handleReorderSpaces,
    handleSaveLoanType,
    handleDeleteLoanType,
    handleSaveActivityType,
    handleDeleteActivityType,
    handleSaveEquipment,
    handleDeleteEquipment,
    handleResetEquipment,
    handleResetDefaults,
    handleSaveUser,
    handleDeleteUser,
    handleResetUsers
  } = useAdminConfig(currentUser, triggerSyncToast);

  // 5. Ratings State Hook
  const {
    ratings,
    setRatings,
    handleSaveRating,
    handleDeleteRating,
    checkRatingAllowed
  } = useRatingsState(reservations);

  // 6. Audit Logs Hook (On-demand listener only when modal is open)
  const { auditLogs } = useAuditLogs(isAuditLogOpen);

  // 7. Space Maintenance Blocks State & Synchronization Hook
  const {
    spaceBlocks,
    setSpaceBlocks,
    handleSaveBlock,
    handleDeleteBlock
  } = useSpaceBlocks({ triggerSyncToast });

  // 7. Autosaved Reservation Draft state for recovery after reload
  const [activeDraft, setActiveDraft] = useState<ActiveDraftSummary | null>(() => getActiveDraftSummary());

  useEffect(() => {
    if (!isReservationModalOpen) {
      setActiveDraft(getActiveDraftSummary());
    }
  }, [isReservationModalOpen]);

  // Notification history
  const [notificationHistory, setNotificationHistory] = useState<AppNotificationItem[]>(() => getNotificationHistory());

  // Filters State (Kept hidden by default)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    espacio: '',
    tipoActividad: '',
    fechaDesde: '',
    fechaHasta: '',
    soloRecurrentes: false,
    soloImportantes: false,
    soloConTopamiento: false
  });
  const [isFilterBarOpen, setIsFilterBarOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Global Keyboard Shortcuts (Ctrl+K, Cmd+K, '/', Alt+N)
  useKeyboardShortcuts({
    onToggleCommandPalette: () => setIsCommandPaletteOpen((prev) => !prev),
    onOpenNewReservation: () => {
      openCreateModal({ date: format(selectedDailyDate || new Date(), 'yyyy-MM-dd') });
    },
    isCommandPaletteOpen
  });

  const hasActiveFilters = Boolean(
    filters.search?.trim() ||
    filters.espacio ||
    filters.tipoActividad ||
    filters.fechaDesde ||
    filters.fechaHasta ||
    filters.soloRecurrentes ||
    filters.soloImportantes ||
    filters.soloConTopamiento
  );

  const handleOpenChangePassword = (targetUser?: AuthUser) => {
    setPasswordTargetUser(targetUser || currentUser || null);
    setIsChangePasswordOpen(true);
  };

  // Automated 15-Day Database Backup Cycle & Periodic Slot Purge
  const [backupToast, setBackupToast] = useState<{
    show: boolean;
    title: string;
    message: string;
    backupId?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const executeScheduledBackupCheck = async () => {
      try {
        const check = await checkAndRunScheduledBackup(reservations);
        if (isMounted && check.triggered && check.backup) {
          console.log(`[Copia Automática 15 Días] Ejecutada con éxito: ${check.backup.id} (${check.backup.totalReservas} reservas)`);
          setBackupToast({
            show: true,
            title: 'Copia de Seguridad Automática Realizada',
            message: `Se ha generado automáticamente la copia de seguridad de la base de datos (ciclo de 15 días: ${check.backup.totalReservas} reservas respaldadas en Firebase).`,
            backupId: check.backup.id
          });

          // Auto-hide toast after 9 seconds
          setTimeout(() => {
            if (isMounted) {
              setBackupToast(null);
            }
          }, 9000);
        }
      } catch (err) {
        console.warn('[Copia Automática 15 Días] Error durante la verificación periódica:', err);
      }
    };

    if (reservations.length > 0) {
      executeScheduledBackupCheck();
      // Purge expired concurrency schedule_slots (> 30 days old, throttled to run at most once a week)
      purgeExpiredScheduleSlots(30).catch((purgeErr) => {
        console.warn('[ScheduleSlotsPurge] Error purgando slots expirados:', purgeErr);
      });
    }

    // Check periodically every 4 hours while the app is active
    const intervalId = setInterval(() => {
      executeScheduledBackupCheck();
    }, 4 * 60 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [reservations.length > 0]);

  const handleOpenRatingModal = (reservation: Reservation, rating?: SpaceRating) => {
    if (!rating) {
      const check = checkRatingAllowed(reservation);
      if (!check.allowed) {
        triggerSyncToast(check.reason || 'No es posible calificar eventos por adelantado.', 'warning');
        return;
      }
    }
    setRatingTargetReservation(reservation);
    setEditingRating(rating || null);
    setIsRatingModalOpen(true);
  };

  // Notification listeners & daily check for important activities
  useEffect(() => {
    const handleHistoryUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<AppNotificationItem[]>;
      setNotificationHistory(customEvent.detail || getNotificationHistory());
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_VIEW' && event.data?.view) {
        setCurrentView(event.data.view as ViewMode);
      }
    };

    window.addEventListener('app_notification_history_changed', handleHistoryUpdate);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.removeEventListener('app_notification_history_changed', handleHistoryUpdate);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  // Automatically activate mobile-optimized view when loaded from a mobile phone
  useEffect(() => {
    if (isMobileDevice()) {
      try {
        const saved = sessionStorage.getItem('gestindeespacios_preferred_view_mode');
        if (!saved) {
          setCurrentView('mobile');
        }
      } catch {
        setCurrentView('mobile');
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const unsub = initNotificationListeners();
      return () => {
        unsub();
      };
    }
  }, [currentUser]);

  useEffect(() => {
    if (reservations.length > 0) {
      checkTodayImportantActivities(reservations);
    }
  }, [reservations]);

  // Initialize Gmail Workspace OAuth Auth State Listener
  useEffect(() => {
    const unsubGmail = initGmailAuthListener();
    return () => {
      unsubGmail();
    };
  }, []);

  const unreadNotificationsCount = useMemo(() => {
    return notificationHistory.filter(n => !n.read).length;
  }, [notificationHistory]);

  // 2. Conflict calculations (Optimized single-pass derived set)
  const conflicts = useMemo(() => detectAllConflicts(reservations), [reservations]);
  const conflictReservationIds = useMemo(() => getConflictReservationIds(reservations, conflicts), [reservations, conflicts]);

  // Pending Deletions waiting for Authorization
  const pendingReservations = useMemo(() => {
    return reservations.filter((r) => Boolean(r.solicitudEliminacion));
  }, [reservations]);

  // 3. Filtered reservations list (precomputing search query and filter constants outside loop)
  const filteredReservations = useMemo(() => {
    const rawSearch = filters.search ? filters.search.trim() : '';
    const hasSearch = Boolean(rawSearch);
    const fuzzyMatchIds = hasSearch ? getFuzzyMatchIds(reservations, rawSearch) : null;

    const filterEspacio = filters.espacio ? filters.espacio.toUpperCase() : null;
    const filterTipo = filters.tipoActividad || null;
    const filterDesde = filters.fechaDesde || null;
    const filterHasta = filters.fechaHasta || null;
    const filterRecurrentes = Boolean(filters.soloRecurrentes);
    const filterImportantes = Boolean(filters.soloImportantes);
    const filterTopamiento = Boolean(filters.soloConTopamiento);

    return reservations.filter((r) => {
      // Topamientos filter
      if (filterTopamiento && !conflictReservationIds.has(r.id)) {
        return false;
      }

      // Quick Toggles
      if (filterRecurrentes && r.actividadRecurrente !== 'Sí') return false;
      if (filterImportantes && r.importante !== 'Sí') return false;

      // Date Range (fast string ISO comparisons)
      if (filterDesde && r.fecha < filterDesde) return false;
      if (filterHasta && r.fecha > filterHasta) return false;

      // Espacio
      if (filterEspacio && r.espacio.toUpperCase() !== filterEspacio) {
        return false;
      }

      // Tipo Actividad
      if (filterTipo && r.tipoActividad !== filterTipo) {
        return false;
      }

      // Fuzzy Search with typo tolerance, accent insensitivity & clean RUT support
      if (hasSearch && fuzzyMatchIds && !fuzzyMatchIds.has(r.id)) {
        return false;
      }

      return true;
    });
  }, [reservations, filters, conflictReservationIds]);

  // Actions
  const handleCreateOrUpdate = async (
    reserva: Reservation,
    generateSeries?: boolean,
    seriesDates?: (string | { fecha: string; horaInicio?: string; horaFin?: string; espacio?: string })[],
    updateWholeSeries?: boolean,
    batchUpdateInfo?: BatchUpdateInfo
  ) => {
    const previousReservations = reservations;
    try {
      // -------------------------------------------------------------
      // CASE 0: TARGETED BATCH UPDATE (PRECISE SCOPE: single, future, series, dateRange, selected)
      // -------------------------------------------------------------
      if (batchUpdateInfo) {
        if (!isCoordinatorOrAdmin(currentUser)) {
          triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para modificar reservas existentes.', 'error');
          return false;
        }

        const { scope, updatedReservations, affectedIds } = batchUpdateInfo;
        if (!updatedReservations || updatedReservations.length === 0) {
          triggerSyncToast('No se encontraron reservas para actualizar.', 'warning');
          return false;
        }

        // Validate conflicts excluding affected reservations
        const conflictsFound = detectBatchConflicts(
          updatedReservations,
          reservations,
          new Set(affectedIds),
          scope === 'series' ? (reserva.serieRecurrente || reserva.recurrenteId) : undefined
        );

        if (conflictsFound.length > 0) {
          const firstConflict = conflictsFound[0];
          const conflictMsg = formatConflictMessage(firstConflict);
          triggerSyncToast(`Operación bloqueada por conflicto de disponibilidad:\n\n${conflictMsg}\n\nNo se realizaron modificaciones.`, 'error');
          return false;
        }

        // Optimistic cache/state update (no duplicates, deterministic sort)
        setReservations((prev) => {
          const map = new Map<string, Reservation>();
          prev.forEach((r) => map.set(r.id, r));
          updatedReservations.forEach((r) => map.set(r.id, r));
          return Array.from(map.values()).sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return a.horaInicio.localeCompare(b.horaInicio);
          });
        });

        // Instant UI reaction: close modal immediately and notify
        setIsReservationModalOpen(false);
        setEditingReservation(null);
        triggerSyncToast(`✓ ${updatedReservations.length} reservas actualizadas al instante`, 'success');

        const scopeNames: Record<string, string> = {
          single: 'Solo esta reserva',
          future: 'Esta y las siguientes',
          series: 'Toda la serie',
          dateRange: 'Rango de fechas',
          selected: 'Fechas seleccionadas'
        };
        const firstRes = updatedReservations[0];

        // Persist to Firestore and record audit in background
        (async () => {
          try {
            if (updatedReservations.length === 1) {
              await saveReservation(updatedReservations[0]);
            } else {
              await saveReservationsBatch(updatedReservations);
            }

            await recordAuditEntry({
              action: 'UPDATE',
              description: batchUpdateInfo.description || `Modificadas ${updatedReservations.length} reservas (${scopeNames[scope] || scope}) para '${firstRes.tipoActividad}' de ${firstRes.responsable}`,
              reservaId: firstRes.id,
              user: currentUser,
              reservaTitle: firstRes.tipoActividad,
              reservaFecha: firstRes.fecha,
              reservaEspacio: firstRes.espacio,
              reservaHorario: `${firstRes.horaInicio} - ${firstRes.horaFin}`,
              reservaResponsable: firstRes.responsable,
              newState: updatedReservations
            });
          } catch (err: any) {
            console.error('Error saving batch reservations in background:', err);
            setReservations(previousReservations);
            triggerSyncToast(`⚠️ Error al sincronizar con el servidor: ${err?.message || 'Error de conexión'}`, 'error');
          }
        })();

        if (conflictsFound.length > 0) {
          setConflictReportData({
            isOpen: true,
            savedCount: updatedReservations.length,
            conflicts: conflictsFound
          });
          notifyTopamiento(conflictsFound);
        }

        if (firstRes.importante === 'Sí') {
          notifyImportantActivity(firstRes, 'updated');
        }

        return true;
      }

      // Normalize incoming series dates / multi-space segments into explicit independent slots
      const explicitSlots: Array<{ fecha: string; horaInicio: string; horaFin: string; espacio: string }> = (seriesDates || []).map((item) => {
        if (typeof item === 'string') {
          return {
            fecha: item,
            horaInicio: reserva.horaInicio || '10:00',
            horaFin: reserva.horaFin || '11:00',
            espacio: reserva.espacio || 'GIMNASIO'
          };
        }
        return {
          fecha: item.fecha,
          horaInicio: item.horaInicio || reserva.horaInicio || '10:00',
          horaFin: item.horaFin || reserva.horaFin || '11:00',
          espacio: item.espacio || reserva.espacio || 'GIMNASIO'
        };
      });

      // -------------------------------------------------------------
      // CASE 1: UPDATE ENTIRE EXISTING SERIES
      // -------------------------------------------------------------
      if (updateWholeSeries && !isSingleDayMultiSpaceReservation(reserva) && (reserva.serieRecurrente || reserva.recurrenteId || reserva.actividadRecurrente === 'Sí')) {
        if (!isCoordinatorOrAdmin(currentUser)) {
          triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para modificar reservas existentes.', 'error');
          return false;
        }
        const seriesId = reserva.serieRecurrente || reserva.recurrenteId;
        
        // Find all active reservations in the series
        const seriesMatches = reservations.filter(
          (r) =>
            Boolean(seriesId && (r.serieRecurrente === seriesId || r.recurrenteId === seriesId)) ||
            (r.id === reserva.id)
        );

        if (seriesMatches.length > 0) {
          const finalSeriesId = seriesId || seriesMatches[0].serieRecurrente || seriesMatches[0].recurrenteId || `SER_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
          let updatedSeriesList: Reservation[] = [];
          const idsToDelete: string[] = [];

          if (explicitSlots.length > 0) {
            // Re-sync with explicit slots (supports multiple segments per day, e.g. 2 spaces/times on Monday & Wednesday)
            const totalCount = explicitSlots.length;
            const existingByDate = new Map<string, Reservation[]>();
            seriesMatches.forEach((m) => {
              const list = existingByDate.get(m.fecha) || [];
              list.push(m);
              existingByDate.set(m.fecha, list);
            });

            const usedExistingIds = new Set<string>();

            updatedSeriesList = explicitSlots.map((item, i) => {
              const matchesForDate = existingByDate.get(item.fecha) || [];
              
              // Best effort match: 1) Same space & time, 2) Same space, 3) Any unused for this date, 4) Any unused in series
              let availableMatch = matchesForDate.find(
                (m) => !usedExistingIds.has(m.id) && m.espacio === item.espacio && m.horaInicio === item.horaInicio
              );
              if (!availableMatch) {
                availableMatch = matchesForDate.find(
                  (m) => !usedExistingIds.has(m.id) && m.espacio === item.espacio
                );
              }
              if (!availableMatch) {
                availableMatch = matchesForDate.find((m) => !usedExistingIds.has(m.id));
              }
              if (!availableMatch) {
                availableMatch = seriesMatches.find((m) => !usedExistingIds.has(m.id));
              }

              const clonedEquip = reserva.equipamientoSolicitado
                ? JSON.parse(JSON.stringify(reserva.equipamientoSolicitado))
                : [];

              if (availableMatch) {
                usedExistingIds.add(availableMatch.id);
                return {
                  ...availableMatch,
                  ...reserva,
                  id: availableMatch.id,
                  fecha: item.fecha,
                  horaInicio: item.horaInicio,
                  horaFin: item.horaFin,
                  espacio: item.espacio,
                  actividadRecurrente: 'Sí',
                  serieRecurrente: finalSeriesId,
                  recurrenteId: finalSeriesId,
                  indiceEnSerie: i + 1,
                  totalEnSerie: totalCount,
                  equipamientoSolicitado: clonedEquip
                };
              } else {
                return {
                  ...reserva,
                  id: `RSV_${Math.random().toString(36).substring(2, 10).toUpperCase()}_${i + 1}`,
                  fecha: item.fecha,
                  horaInicio: item.horaInicio,
                  horaFin: item.horaFin,
                  espacio: item.espacio,
                  actividadRecurrente: 'Sí',
                  serieRecurrente: finalSeriesId,
                  recurrenteId: finalSeriesId,
                  indiceEnSerie: i + 1,
                  totalEnSerie: totalCount,
                  equipamientoSolicitado: clonedEquip
                };
              }
            });

            // Mark unneeded existing series items for deletion (e.g. series was shortened)
            seriesMatches.forEach((m) => {
              if (!usedExistingIds.has(m.id)) {
                if (!isSingleDayMultiSpaceReservation(m)) {
                  idsToDelete.push(m.id);
                }
              }
            });
          } else {
            // General series metadata update while strictly preserving each session's individual date, time, and space
            updatedSeriesList = seriesMatches.map((item, idx) => ({
              ...item,
              descripcion: reserva.descripcion,
              tipoActividad: reserva.tipoActividad,
              responsable: reserva.responsable,
              telefonoContacto: reserva.telefonoContacto,
              emailContacto: reserva.emailContacto,
              tipoPrestamo: reserva.tipoPrestamo,
              importante: reserva.importante,
              comentarios: reserva.comentarios,
              rut: reserva.rut,
              domicilio: reserva.domicilio,
              cantidadParticipantes: reserva.cantidadParticipantes,
              equipamientoSolicitado: reserva.equipamientoSolicitado
                ? JSON.parse(JSON.stringify(reserva.equipamientoSolicitado))
                : [],
              requiereCartaCompromiso: reserva.requiereCartaCompromiso,
              cartaCompromisoDescargada: reserva.cartaCompromisoDescargada,
              cartaCompromisoAdjunta: reserva.cartaCompromisoAdjunta,
              actividadRecurrente: 'Sí',
              serieRecurrente: finalSeriesId,
              recurrenteId: finalSeriesId,
              indiceEnSerie: item.indiceEnSerie || idx + 1,
              totalEnSerie: seriesMatches.length
            }));
          }

          // Detect any batch conflicts independently for every segment excluding current series
          const conflictsFound = detectBatchConflicts(
            updatedSeriesList,
            reservations,
            new Set(seriesMatches.map((m) => m.id)),
            finalSeriesId
          );

          if (conflictsFound.length > 0) {
            const firstConflict = conflictsFound[0];
            const conflictMsg = formatConflictMessage(firstConflict);
            triggerSyncToast(`Operación bloqueada por conflicto de disponibilidad:\n\n${conflictMsg}\n\nNo se realizaron modificaciones en la serie.`, 'error');
            return false;
          }

          // Optimistic state update across all segments
          setReservations((prev) => {
            const map = new Map<string, Reservation>();
            prev.forEach((r) => {
              if (!idsToDelete.includes(r.id)) {
                map.set(r.id, r);
              }
            });
            updatedSeriesList.forEach((r) => map.set(r.id, r));
            return Array.from(map.values()).sort((a, b) => {
              if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
              return a.horaInicio.localeCompare(b.horaInicio);
            });
          });

          // Instant UI reaction: close modal immediately and notify
          setIsReservationModalOpen(false);
          setEditingReservation(null);
          triggerSyncToast(`✓ Serie actualizada al instante (${updatedSeriesList.length} sesiones)`, 'success');

          // Asynchronously persist to database and record audit in background
          (async () => {
            try {
              for (const delId of idsToDelete) {
                deleteReservationById(delId).catch((err) => console.warn('Error deleting old series session:', err));
              }

              await saveReservationsBatch(updatedSeriesList);

              await recordAuditEntry({
                action: 'UPDATE',
                description: `Actualizada serie recurrente de ${updatedSeriesList.length} reservas para '${reserva.tipoActividad || 'Actividad'}' (${reserva.responsable})`,
                reservaId: finalSeriesId,
                user: currentUser,
                reservaTitle: reserva.tipoActividad,
                reservaFecha: reserva.fecha,
                reservaEspacio: reserva.espacio,
                reservaHorario: `${reserva.horaInicio} - ${reserva.horaFin}`,
                reservaResponsable: reserva.responsable,
                newState: updatedSeriesList
              });
            } catch (err: any) {
              console.error('Error saving series in background:', err);
              setReservations(previousReservations);
              triggerSyncToast(`⚠️ Error al sincronizar serie con el servidor: ${err?.message || 'Error de conexión'}`, 'error');
            }
          })();

          if (conflictsFound.length > 0) {
            setConflictReportData({
              isOpen: true,
              savedCount: updatedSeriesList.length,
              conflicts: conflictsFound
            });
            notifyTopamiento(conflictsFound);
          }

          if (reserva.importante === 'Sí') {
            notifyImportantActivity(reserva, 'updated');
          }

          return true;
        }
      }

      // -------------------------------------------------------------
      // CASE 2: CREATE NEW SERIES OR MULTI-SEGMENT RESERVATIONS
      // -------------------------------------------------------------
      const isMultiSlot = explicitSlots.length > 0;
      const isSeriesCreation = generateSeries || isMultiSlot || (reserva.actividadRecurrente === 'Sí' && explicitSlots.length > 1);

      if (isSeriesCreation) {
        const isMultiSpaceSingleDay = (reserva.tipoRecurrencia === 'doble_espacio') ||
          (explicitSlots.length === 2 && explicitSlots[0].fecha === explicitSlots[1].fecha && reserva.actividadRecurrente !== 'Sí');

        const seriesId = isMultiSpaceSingleDay
          ? undefined
          : (reserva.serieRecurrente || reserva.recurrenteId || `SER_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
        
        let itemsToGenerate: Array<{ fecha: string; horaInicio: string; horaFin: string; espacio: string }> = [];
        if (explicitSlots.length > 0) {
          itemsToGenerate = explicitSlots;
        } else {
          const totalWeeks = reserva.totalEnSerie || 12;
          const baseDate = parseISO(reserva.fecha);
          for (let i = 0; i < totalWeeks; i++) {
            itemsToGenerate.push({
              fecha: format(addWeeks(baseDate, i), 'yyyy-MM-dd'),
              horaInicio: reserva.horaInicio || '10:00',
              horaFin: reserva.horaFin || '11:00',
              espacio: reserva.espacio || 'GIMNASIO'
            });
          }
        }

        const totalCount = itemsToGenerate.length;
        const usedIds = new Set<string>();
        const nowIso = new Date().toISOString();

        const seriesList: Reservation[] = itemsToGenerate.map((item, i) => {
          const clonedEquip = reserva.equipamientoSolicitado
            ? JSON.parse(JSON.stringify(reserva.equipamientoSolicitado))
            : [];
          
          let uniqueId: string;
          if (i === 0 && reserva.id && !reservations.some(r => r.id === reserva.id) && !usedIds.has(reserva.id)) {
            uniqueId = reserva.id;
          } else {
            uniqueId = `RSV_${Date.now().toString(36).toUpperCase()}_${String(i + 1).padStart(3, '0')}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          }
          usedIds.add(uniqueId);

          return {
            ...reserva,
            id: uniqueId,
            fecha: item.fecha.trim().split('T')[0],
            horaInicio: item.horaInicio.trim(),
            horaFin: item.horaFin.trim(),
            espacio: normalizeSpaceName(item.espacio || reserva.espacio || 'GIMNASIO'),
            responsable: (reserva.responsable || 'Responsable').trim(),
            tipoActividad: (reserva.tipoActividad || 'Actividad').trim(),
            descripcion: (reserva.descripcion || '').trim(),
            estado: 'activa',
            realizada: 'No',
            actividadRecurrente: isMultiSpaceSingleDay ? 'No' : (totalCount > 1 || reserva.actividadRecurrente === 'Sí' ? 'Sí' : 'No'),
            serieRecurrente: isMultiSpaceSingleDay ? undefined : seriesId,
            recurrenteId: isMultiSpaceSingleDay ? undefined : seriesId,
            indiceEnSerie: i + 1,
            totalEnSerie: totalCount,
            tipoRecurrencia: isMultiSpaceSingleDay ? 'doble_espacio' : reserva.tipoRecurrencia,
            equipamientoSolicitado: clonedEquip,
            createdBy: reserva.createdBy || currentUser?.username || currentUser?.name || 'sistema',
            createdAt: reserva.createdAt || nowIso,
            updatedAt: nowIso
          };
        });

        // Detect any conflicts independently for every candidate segment against database
        const conflictsFound = detectBatchConflicts(seriesList, reservations);

        if (conflictsFound.length > 0) {
          const firstConflict = conflictsFound[0];
          const conflictMsg = formatConflictMessage(firstConflict);
          triggerSyncToast(`Creación bloqueada por conflicto de disponibilidad:\n\n${conflictMsg}\n\nNo se crearon las reservas.`, 'error');
          return false;
        }

        // Instant optimistic React state update: all segments stored and sorted
        setReservations((prev) => {
          const map = new Map<string, Reservation>();
          prev.forEach((r) => map.set(r.id, r));
          seriesList.forEach((r) => map.set(r.id, r));
          return Array.from(map.values()).sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return a.horaInicio.localeCompare(b.horaInicio);
          });
        });

        // Instant UI reaction: close modal immediately and notify
        setIsReservationModalOpen(false);
        setEditingReservation(null);
        triggerSyncToast(`✓ Serie de ${seriesList.length} reservas creada al instante`, 'success');

        // Fast batch persistence to Firestore and audit log in background
        (async () => {
          try {
            await saveReservationsBatch(seriesList);

            await recordAuditEntry({
              action: 'CREATE',
              description: `Creada serie recurrente de ${seriesList.length} reservas para '${reserva.tipoActividad || 'Actividad'}' (${reserva.espacio})`,
              reservaId: seriesId || seriesList[0]?.id || 'SERIES',
              user: currentUser,
              reservaTitle: reserva.tipoActividad,
              reservaFecha: reserva.fecha,
              reservaEspacio: reserva.espacio,
              reservaHorario: `${reserva.horaInicio} - ${reserva.horaFin}`,
              reservaResponsable: reserva.responsable,
              newState: seriesList
            });
          } catch (err: any) {
            console.error('Error in background series creation save:', err);
            setReservations(previousReservations);
            triggerSyncToast(`⚠️ Error al guardar serie en el servidor: ${err?.message || 'Error de conexión'}`, 'error');
          }
        })();

        // If conflicts were found across any dates/spaces, notify without truncating
        if (conflictsFound.length > 0) {
          setConflictReportData({
            isOpen: true,
            savedCount: seriesList.length,
            conflicts: conflictsFound
          });
          notifyTopamiento(conflictsFound);
        }

        if (reserva.importante === 'Sí') {
          notifyImportantActivity(reserva, 'created');
        }

        return true;
      } else {
        // -------------------------------------------------------------
        // CASE 3: SINGLE STANDALONE RESERVATION
        // -------------------------------------------------------------
        const nowIso = new Date().toISOString();
        const baseReserva = isSingleDayMultiSpaceReservation(reserva)
          ? {
              ...reserva,
              actividadRecurrente: 'No' as const,
              serieRecurrente: undefined,
              recurrenteId: undefined
            }
          : reserva;

        const cleanReserva: Reservation = {
          ...baseReserva,
          id: baseReserva.id || `RSV_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          fecha: baseReserva.fecha.trim().split('T')[0],
          horaInicio: baseReserva.horaInicio.trim(),
          horaFin: baseReserva.horaFin.trim(),
          espacio: normalizeSpaceName(baseReserva.espacio || 'GIMNASIO'),
          responsable: (baseReserva.responsable || 'Responsable').trim(),
          tipoActividad: (baseReserva.tipoActividad || 'Actividad').trim(),
          descripcion: (baseReserva.descripcion || '').trim(),
          estado: baseReserva.estado || 'activa',
          realizada: baseReserva.realizada || 'No',
          createdBy: baseReserva.createdBy || currentUser?.username || currentUser?.name || 'sistema',
          createdAt: baseReserva.createdAt || nowIso,
          updatedAt: nowIso
        };

        const existingRes = reservations.find((r) => r.id === cleanReserva.id);
        const isEditing = !!existingRes;
        if (isEditing && !isCoordinatorOrAdmin(currentUser)) {
          triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para modificar reservas existentes.', 'error');
          return false;
        }
        const conflictsFound = detectBatchConflicts([cleanReserva], reservations, new Set([cleanReserva.id]));

        if (conflictsFound.length > 0) {
          const firstConflict = conflictsFound[0];
          const conflictMsg = formatConflictMessage(firstConflict);
          triggerSyncToast(`Operación bloqueada por conflicto de disponibilidad:\n\n${conflictMsg}\n\nNo se guardó la reserva.`, 'error');
          return false;
        }

        // Instant optimistic React state update
        setReservations((prev) => {
          const index = prev.findIndex((r) => r.id === cleanReserva.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = cleanReserva;
            return next.sort((a, b) => {
              if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
              return a.horaInicio.localeCompare(b.horaInicio);
            });
          }
          return [cleanReserva, ...prev].sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return a.horaInicio.localeCompare(b.horaInicio);
          });
        });

        // Instant UI reaction: close modal immediately and notify
        setIsReservationModalOpen(false);
        setEditingReservation(null);
        triggerSyncToast(isEditing ? '✓ Reserva actualizada al instante' : '✓ Reserva guardada al instante', 'success');

        // Background persistence and audit logging
        (async () => {
          try {
            await saveReservation(cleanReserva);

            if (isEditing && existingRes) {
              const diffs = computeReservationDiff(existingRes, cleanReserva);
              await recordAuditEntry({
                action: 'UPDATE',
                description: `Modificada reserva '${cleanReserva.tipoActividad || 'Actividad'}' de ${cleanReserva.responsable || 'Responsable'} (${diffs.length} cambios)`,
                reservaId: cleanReserva.id,
                user: currentUser,
                reservaTitle: cleanReserva.tipoActividad,
                reservaFecha: cleanReserva.fecha,
                reservaEspacio: cleanReserva.espacio,
                reservaHorario: `${cleanReserva.horaInicio} - ${cleanReserva.horaFin}`,
                reservaResponsable: cleanReserva.responsable,
                previousState: existingRes,
                newState: cleanReserva,
                diffs
              });
            } else {
              await recordAuditEntry({
                action: 'CREATE',
                description: `Creada reserva '${cleanReserva.tipoActividad || 'Actividad'}' para ${cleanReserva.responsable || 'Responsable'} (${cleanReserva.espacio})`,
                reservaId: cleanReserva.id,
                user: currentUser,
                reservaTitle: cleanReserva.tipoActividad,
                reservaFecha: cleanReserva.fecha,
                reservaEspacio: cleanReserva.espacio,
                reservaHorario: `${cleanReserva.horaInicio} - ${cleanReserva.horaFin}`,
                reservaResponsable: cleanReserva.responsable,
                newState: cleanReserva
              });
            }
          } catch (err: any) {
            console.error('Error saving single reservation in background:', err);
            setReservations(previousReservations);
            triggerSyncToast(`⚠️ Error al guardar en el servidor: ${err?.message || 'Error de conexión'}`, 'error');
          }
        })();

        if (conflictsFound.length > 0) {
          setConflictReportData({
            isOpen: true,
            savedCount: 1,
            conflicts: conflictsFound
          });
          notifyTopamiento(conflictsFound);
        }

        if (cleanReserva.importante === 'Sí') {
          notifyImportantActivity(cleanReserva, isEditing ? 'updated' : 'created');
        }

        return true;
      }
    } catch (err: any) {
      console.error('Error saving reservation:', err);
      setReservations(previousReservations);
      triggerSyncToast(`⚠️ Error al guardar en Firestore: ${err?.message || 'Error de conexión'}. Se restableció el estado anterior.`, 'error');
      return false;
    }
  };


  const handleDelete = async (id: string, isSeries?: boolean, seriesId?: string) => {
    if (!isCoordinatorOrAdmin(currentUser)) {
      const target = reservations.find((r) => r.id === id || (seriesId && (r.serieRecurrente === seriesId || r.recurrenteId === seriesId)));
      if (target) {
        handleRequestDelete(target);
        return;
      }
      triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para eliminar reservas directamente.', 'error');
      return;
    }

    const previousReservations = reservations;
    const toDeleteSeries = isSeries && seriesId ? reservations.filter((r) => r.serieRecurrente === seriesId || r.recurrenteId === seriesId) : [];
    const toDeleteSingle = !isSeries ? reservations.find((r) => r.id === id) : null;

    // 1. Instant optimistic UI update (0ms delay)
    setReservations((prev) => {
      if (isSeries && seriesId) {
        return prev.filter((r) => r.serieRecurrente !== seriesId && r.recurrenteId !== seriesId);
      }
      return prev.filter((r) => r.id !== id);
    });

    if (selectedReservation && (selectedReservation.id === id || (isSeries && (selectedReservation.serieRecurrente === seriesId || selectedReservation.recurrenteId === seriesId)))) {
      setIsDetailModalOpen(false);
      setSelectedReservation(null);
    }

    triggerSyncToast(isSeries ? `✓ Serie de ${toDeleteSeries.length} reservas eliminada al instante` : '✓ Reserva eliminada al instante', 'info');

    // 2. Background database deletion and audit logging
    (async () => {
      try {
        if (isSeries && seriesId) {
          if (toDeleteSeries.length > 0) {
            const first = toDeleteSeries[0];
            await recordAuditEntry({
              action: 'DELETE_SERIES',
              description: `Eliminada serie recurrente de ${toDeleteSeries.length} reservas para '${first.tipoActividad || 'Actividad'}' (${first.espacio})`,
              reservaId: seriesId,
              user: currentUser,
              reservaTitle: first.tipoActividad,
              reservaFecha: first.fecha,
              reservaEspacio: first.espacio,
              reservaHorario: `${first.horaInicio} - ${first.horaFin}`,
              reservaResponsable: first.responsable,
              previousState: toDeleteSeries
            });
          }
          await deleteSeriesByRecurrenteId(seriesId, toDeleteSeries.map((r) => r.id));
        } else if (toDeleteSingle) {
          await recordAuditEntry({
            action: 'DELETE',
            description: `Eliminada reserva '${toDeleteSingle.tipoActividad || 'Actividad'}' de ${toDeleteSingle.responsable || 'Responsable'} (${toDeleteSingle.fecha}, ${toDeleteSingle.espacio})`,
            reservaId: id,
            user: currentUser,
            reservaTitle: toDeleteSingle.tipoActividad,
            reservaFecha: toDeleteSingle.fecha,
            reservaEspacio: toDeleteSingle.espacio,
            reservaHorario: `${toDeleteSingle.horaInicio} - ${toDeleteSingle.horaFin}`,
            reservaResponsable: toDeleteSingle.responsable,
            previousState: toDeleteSingle
          });
          await deleteReservationById(id);
        }
      } catch (err: any) {
        console.error('Error executing delete in background:', err);
        setReservations(previousReservations);
        triggerSyncToast(`⚠️ Error al eliminar en el servidor: ${err?.message || 'Error de conexión'}`, 'error');
      }
    })();
  };

  const handleRequestDelete = (reserva: Reservation) => {
    setDeleteTargetReservation(reserva);
    setIsDeleteModalOpen(true);
  };

  const handleSubmitDeleteRequest = async (
    reservation: Reservation,
    motivo?: string,
    isSeries?: boolean,
    seriesId?: string
  ) => {
    try {
      const solicitudInfo = {
        solicitadoPor: currentUser?.username || 'usuario',
        solicitadoPorNombre: currentUser?.name || currentUser?.username || 'Personal',
        solicitadoPorRol: currentUser?.role || 'Personal',
        fechaSolicitud: new Date().toISOString(),
        motivo: motivo?.trim() || undefined,
        esSerie: Boolean(isSeries)
      };

      if (isSeries && seriesId) {
        const toUpdate = reservations.filter(
          (r) => r.serieRecurrente === seriesId || r.recurrenteId === seriesId
        );
        const updatedList = toUpdate.map((r) => ({
          ...r,
          solicitudEliminacion: solicitudInfo
        }));

        setReservations((prev) =>
          prev.map((r) => {
            if (r.serieRecurrente === seriesId || r.recurrenteId === seriesId) {
              return { ...r, solicitudEliminacion: solicitudInfo };
            }
            return r;
          })
        );

        await saveReservationsBatch(updatedList);

        await recordAuditEntry({
          action: 'REQUEST_DELETE',
          description: `Solicitud de eliminación de serie enviada por ${currentUser?.name || currentUser?.username} (${toUpdate.length} reservas) - En espera de autorización. Motivo: ${motivo || 'No especificado'}`,
          reservaId: seriesId,
          user: currentUser,
          reservaTitle: reservation.tipoActividad,
          reservaFecha: reservation.fecha,
          reservaEspacio: reservation.espacio,
          reservaHorario: `${reservation.horaInicio} - ${reservation.horaFin}`,
          reservaResponsable: reservation.responsable
        });
      } else {
        const updatedReservation: Reservation = {
          ...reservation,
          solicitudEliminacion: solicitudInfo
        };

        setReservations((prev) =>
          prev.map((r) => (r.id === reservation.id ? updatedReservation : r))
        );

        await saveReservation(updatedReservation);

        await recordAuditEntry({
          action: 'REQUEST_DELETE',
          description: `Solicitud de eliminación enviada por ${currentUser?.name || currentUser?.username} para reserva '${reservation.tipoActividad}' (${reservation.fecha}, ${reservation.espacio}) - En espera de autorización. Motivo: ${motivo || 'No especificado'}`,
          reservaId: reservation.id,
          user: currentUser,
          reservaTitle: reservation.tipoActividad,
          reservaFecha: reservation.fecha,
          reservaEspacio: reservation.espacio,
          reservaHorario: `${reservation.horaInicio} - ${reservation.horaFin}`,
          reservaResponsable: reservation.responsable
        });
      }

      triggerSyncToast(
        `Solicitud enviada correctamente. La reserva quedó 'En Espera de Autorización'. Un Administrador revisará la eliminación.`,
        'info'
      );
    } catch (err) {
      console.error('Error submitting delete request:', err);
      triggerSyncToast('Ocurrió un error al enviar la solicitud de eliminación.', 'error');
    }
  };

  const handleAuthorizeDelete = async (reservation: Reservation) => {
    if (!isCoordinatorOrAdmin(currentUser)) {
      triggerSyncToast('Permiso denegado: Solo usuarios con perfil Administrador o Coordinador pueden autorizar eliminaciones.', 'error');
      return;
    }

    try {
      const isSeries = reservation.solicitudEliminacion?.esSerie;
      const seriesId = reservation.recurrenteId || reservation.serieRecurrente;

      if (isSeries && seriesId) {
        const toDelete = reservations.filter(
          (r) => r.serieRecurrente === seriesId || r.recurrenteId === seriesId
        );

        await recordAuditEntry({
          action: 'AUTHORIZE_DELETE',
          description: `Autorizada eliminación de serie recurrente (${toDelete.length} reservas) solicitada por ${reservation.solicitudEliminacion?.solicitadoPorNombre || 'Personal'}`,
          reservaId: seriesId,
          user: currentUser,
          reservaTitle: reservation.tipoActividad,
          reservaFecha: reservation.fecha,
          reservaEspacio: reservation.espacio,
          reservaHorario: `${reservation.horaInicio} - ${reservation.horaFin}`,
          reservaResponsable: reservation.responsable,
          previousState: toDelete
        });

        setReservations((prev) =>
          prev.filter((r) => r.serieRecurrente !== seriesId && r.recurrenteId !== seriesId)
        );
        await deleteSeriesByRecurrenteId(seriesId);
      } else {
        await recordAuditEntry({
          action: 'AUTHORIZE_DELETE',
          description: `Autorizada y confirmada eliminación definitiva de reserva '${reservation.tipoActividad}' (${reservation.fecha}, ${reservation.espacio}) solicitada por ${reservation.solicitudEliminacion?.solicitadoPorNombre || 'Personal'}`,
          reservaId: reservation.id,
          user: currentUser,
          reservaTitle: reservation.tipoActividad,
          reservaFecha: reservation.fecha,
          reservaEspacio: reservation.espacio,
          reservaHorario: `${reservation.horaInicio} - ${reservation.horaFin}`,
          reservaResponsable: reservation.responsable,
          previousState: reservation
        });

        setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
        await deleteReservationById(reservation.id);
      }

      if (selectedReservation?.id === reservation.id) {
        setIsDetailModalOpen(false);
        setSelectedReservation(null);
      }
    } catch (err) {
      console.error('Error authorizing delete:', err);
      triggerSyncToast('Ocurrió un error al autorizar la eliminación.', 'error');
    }
  };

  const handleRejectDeleteRequest = async (reservation: Reservation) => {
    const isRequester = currentUser?.username === reservation.solicitudEliminacion?.solicitadoPor;
    if (!isCoordinatorOrAdmin(currentUser) && !isRequester) {
      triggerSyncToast('Permiso denegado: Solo Administradores, Coordinadores o el solicitante pueden descartar esta solicitud.', 'error');
      return;
    }

    try {
      const isSeries = reservation.solicitudEliminacion?.esSerie;
      const seriesId = reservation.recurrenteId || reservation.serieRecurrente;

      if (isSeries && seriesId) {
        const toUpdate = reservations.filter(
          (r) => r.serieRecurrente === seriesId || r.recurrenteId === seriesId
        );
        const updatedList = toUpdate.map((r) => {
          const copy = { ...r };
          delete copy.solicitudEliminacion;
          return copy;
        });

        setReservations((prev) =>
          prev.map((r) => {
            if (r.serieRecurrente === seriesId || r.recurrenteId === seriesId) {
              const copy = { ...r };
              delete copy.solicitudEliminacion;
              return copy;
            }
            return r;
          })
        );

        await saveReservationsBatch(updatedList);

        await recordAuditEntry({
          action: 'REJECT_DELETE_REQUEST',
          description: `Solicitud de eliminación de serie descartada/rechazada por ${currentUser?.name || currentUser?.username}. Las reservas se mantienen activas.`,
          reservaId: seriesId,
          user: currentUser,
          reservaTitle: reservation.tipoActividad,
          reservaFecha: reservation.fecha,
          reservaEspacio: reservation.espacio,
          reservaHorario: `${reservation.horaInicio} - ${reservation.horaFin}`,
          reservaResponsable: reservation.responsable
        });
      } else {
        const copy: Reservation = { ...reservation };
        delete copy.solicitudEliminacion;

        setReservations((prev) =>
          prev.map((r) => (r.id === reservation.id ? copy : r))
        );

        await saveReservation(copy);

        await recordAuditEntry({
          action: 'REJECT_DELETE_REQUEST',
          description: `Solicitud de eliminación rechazada/descartada por ${currentUser?.name || currentUser?.username} para '${reservation.tipoActividad}'. La reserva permanece activa.`,
          reservaId: reservation.id,
          user: currentUser,
          reservaTitle: reservation.tipoActividad,
          reservaFecha: reservation.fecha,
          reservaEspacio: reservation.espacio,
          reservaHorario: `${reservation.horaInicio} - ${reservation.horaFin}`,
          reservaResponsable: reservation.responsable
        });
      }

      if (selectedReservation?.id === reservation.id) {
        const copy = { ...selectedReservation };
        delete copy.solicitudEliminacion;
        setSelectedReservation(copy);
      }
    } catch (err) {
      console.error('Error rejecting delete request:', err);
      triggerSyncToast('Ocurrió un error al procesar la solicitud.', 'error');
    }
  };

  const handleConfirmDeleteSingle = async (id: string) => {
    await handleDelete(id, false);
  };

  const handleConfirmDeleteSeries = async (seriesId: string) => {
    await handleDelete('', true, seriesId);
  };

  const handleClearParticipants = async (reserva: Reservation) => {
    if (!isCoordinatorOrAdmin(currentUser)) {
      triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para modificar reservas.', 'error');
      return;
    }
    const updated: Reservation = {
      ...reserva,
      cantidadParticipantes: 0
    };

    // Instant optimistic update
    setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    triggerSyncToast('✓ Aforo restablecido a 0', 'success');

    // Background persistence
    (async () => {
      try {
        await saveReservation(updated);
        await recordAuditEntry({
          action: 'CLEAR_PARTICIPANTS',
          description: `Limpiado aforo/participantes en reserva '${reserva.tipoActividad}' (anterior: ${reserva.cantidadParticipantes || 0})`,
          reservaId: reserva.id,
          user: currentUser,
          reservaTitle: reserva.tipoActividad,
          reservaFecha: reserva.fecha,
          reservaEspacio: reserva.espacio,
          reservaHorario: `${reserva.horaInicio} - ${reserva.horaFin}`,
          reservaResponsable: reserva.responsable,
          previousState: reserva,
          newState: updated
        });
      } catch (err: any) {
        console.error('Error clearing participants in background:', err);
      }
    })();
  };

  const handleQuickToggleRealizada = async (reserva: Reservation) => {
    if (!isCoordinatorOrAdmin(currentUser)) {
      triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para modificar reservas.', 'error');
      return;
    }
    const nextVal = reserva.realizada === 'Sí' ? 'No' : 'Sí';
    const updated: Reservation = {
      ...reserva,
      realizada: nextVal
    };

    // Instant optimistic update (0ms UI feedback)
    setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    triggerSyncToast(`✓ Marcada como ${nextVal === 'Sí' ? 'Realizada' : 'Pendiente'}`, 'success');

    // Background persistence
    (async () => {
      try {
        await saveReservation(updated);
        await recordAuditEntry({
          action: 'TOGGLE_REALIZADA',
          description: `Cambiado estado 'Realizada' a '${nextVal}' en '${reserva.tipoActividad}' (${reserva.espacio})`,
          reservaId: reserva.id,
          user: currentUser,
          reservaTitle: reserva.tipoActividad,
          reservaFecha: reserva.fecha,
          reservaEspacio: reserva.espacio,
          reservaHorario: `${reserva.horaInicio} - ${reserva.horaFin}`,
          reservaResponsable: reserva.responsable,
          previousState: reserva,
          newState: updated
        });
      } catch (err: any) {
        console.error('Error saving realizada toggle in background:', err);
      }
    })();
  };

  const handleSyncAllToFirebase = async () => {
    setIsFirebaseSyncing(true);
    try {
      const res = await seedAllToFirestore(reservations);
      setIsFirebaseConnected(true);
      setLastSyncTime(Date.now());
      return res;
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  const handleImportReservations = async (importedList: Reservation[]) => {
    const merged = [...importedList, ...reservations];
    // deduplicate by id
    const map = new Map<string, Reservation>();
    merged.forEach(r => map.set(r.id, r));
    const deduped = Array.from(map.values());
    setReservations(deduped);
    await seedAllToFirestore(deduped);
    await recordAuditEntry({
      action: 'BULK_IMPORT',
      description: `Importadas / Sincronizadas ${importedList.length} reservas`,
      reservaId: 'BULK_IMPORT',
      user: currentUser,
      newState: importedList
    });
  };

  const handleAuthSuccess = (user: AuthUser) => {
    saveAuthUser(user);
    setCurrentUser(user);
    setIsPasswordPromptOpen(false);
    if (pendingAuthAction) {
      const action = pendingAuthAction;
      setPendingAuthAction(null);
      action();
    }
  };

  const requireAuth = (action: () => void, description?: string) => {
    if (currentUser) {
      action();
    } else {
      setPendingAuthAction(() => action);
      setAuthActionDescription(description || 'modificar o crear reservas');
      setIsPasswordPromptOpen(true);
    }
  };

  const handleDeleteAllHolidays = async () => {
    const holidaysBefore = reservations.filter(r => isChileanHoliday(r.fecha));
    const res = await deleteAllHolidayReservations();
    if (res.deletedCount > 0) {
      await recordAuditEntry({
        action: 'DELETE_ALL_HOLIDAYS',
        description: `Eliminadas automáticamente ${res.deletedCount} reservas en días feriados de Chile`,
        reservaId: 'HOLIDAYS_PURGE',
        user: currentUser,
        previousState: holidaysBefore
      });
    }
    setReservations(res.remainingReservations);
    return { deletedCount: res.deletedCount };
  };

  const handleLogout = () => {
    clearAuthUser();
    setCurrentUser(null);
  };

  const handleCalendarSelectReservation = useCallback((r: Reservation) => {
    setSelectedReservation(r);
    setIsDetailModalOpen(true);
  }, []);

  const handleDuplicateReservation = (sourceReserva: Reservation) => {
    requireAuth(() => {
      const newId = `RSV_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const duplicate: Reservation = {
        ...sourceReserva,
        id: newId,
        descripcion: sourceReserva.descripcion
          ? (sourceReserva.descripcion.includes('(Copia)') ? sourceReserva.descripcion : `${sourceReserva.descripcion} (Copia)`)
          : `${sourceReserva.tipoActividad || 'Reserva'} (Copia)`,
        realizada: 'No',
        actividadRecurrente: 'No',
        serieRecurrente: undefined,
        recurrenteId: undefined,
        indiceEnSerie: undefined,
        totalEnSerie: undefined,
        equipamientoSolicitado: sourceReserva.equipamientoSolicitado
          ? JSON.parse(JSON.stringify(sourceReserva.equipamientoSolicitado))
          : []
      };
      setEditingReservation(duplicate);
      setIsDuplicating(true);
      setPrefillDate(duplicate.fecha || format(new Date(), 'yyyy-MM-dd'));
      setPrefillSpace(duplicate.espacio);
      setPrefillStartTime(duplicate.horaInicio || '10:00');
      setPrefillEndTime(duplicate.horaFin || '11:00');
      setIsReservationModalOpen(true);
    }, 'duplicar esta reserva');
  };

  const handleCalendarNewReservationForDate = useCallback((dateStr: string) => {
    requireAuth(() => {
      setEditingReservation(null);
      setIsDuplicating(false);
      setPrefillDate(dateStr);
      setPrefillSpace(filters.espacio || spaces[0]?.name || 'TATAMI');
      setPrefillStartTime('10:00');
      setPrefillEndTime('11:00');
      setIsReservationModalOpen(true);
    }, 'crear una reserva en esta fecha');
  }, [filters.espacio, spaces, currentUser]);

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Network Status Banner (Hallazgo 8) */}
      {!isOnline && (
        <div
          id="offline-status-banner"
          role="status"
          aria-live="polite"
          className="bg-amber-600 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-center gap-2.5 shadow-xs sticky top-0 z-50 animate-fadeIn border-b border-amber-700/40"
        >
          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/80 ring-1 ring-amber-300/40 shrink-0 text-amber-100 shadow-2xs animate-subtle-pulse">
            <WifiOff className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <span className="leading-snug text-center sm:text-left">
            <strong className="font-semibold text-amber-100">Sin conexión a internet:</strong> La aplicación funciona en modo local y sincronizará los cambios automáticamente cuando se restablezca la red.
          </span>
        </div>
      )}

      {showReconnectedAlert && isOnline && (
        <div
          id="online-status-banner"
          role="status"
          aria-live="polite"
          className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-center gap-2.5 shadow-xs sticky top-0 z-50 animate-fadeIn border-b border-emerald-700/40"
        >
          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-emerald-700/80 ring-1 ring-emerald-300/40 shrink-0 text-emerald-100 shadow-2xs animate-subtle-pulse">
            <Wifi className="w-3.5 h-3.5 stroke-[2.2]" />
          </div>
          <span className="leading-snug text-center sm:text-left">
            <strong className="font-semibold text-emerald-100">Conexión restablecida:</strong> Sincronización en la nube activa y actualizada.
          </span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        onViewChange={(v) => {
          persistViewPreference(v);
          if (v === 'admin') {
            requireAuth(() => setCurrentView('admin'), 'acceder al panel de administración');
          } else if (v === 'directory') {
            setAdminSubTab('applicants');
            requireAuth(() => setCurrentView('admin'), 'acceder al registro de solicitantes');
          } else if (v === 'maintenance') {
            setAdminSubTab('maintenance');
            requireAuth(() => setCurrentView('admin'), 'acceder a mantención y bloqueos');
          } else {
            setCurrentView(v);
          }
        }}
        onNewReservation={() => {
          requireAuth(() => {
            setEditingReservation(null);
            setIsDuplicating(false);
            setPrefillDate(format(selectedDailyDate || new Date(), 'yyyy-MM-dd'));
            const initialSpace = filters.espacio || spaces[0]?.name || 'TATAMI';
            setPrefillSpace(initialSpace);
            setPrefillStartTime('10:00');
            setPrefillEndTime('11:00');
            setIsReservationModalOpen(true);
          }, 'crear una nueva reserva');
        }}
        onOpenImportExport={() => {
          requireAuth(() => setIsImportExportModalOpen(true), 'importar o exportar reservas');
        }}
        onOpenAuditLog={() => {
          if (!isCoordinatorOrAdmin(currentUser)) {
            triggerSyncToast('El sistema de restauración de cambios está disponible únicamente para Administradores y Coordinadores.', 'warning');
            return;
          }
          setIsAuditLogOpen(true);
        }}
        onOpenPrintModal={() => setIsGlobalPrintModalOpen(true)}
        onOpenGmailDispatch={() => openGmailDispatchModal()}
        onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        pendingDeletionsCount={pendingReservations.length}
        onOpenPendingDeletions={() => setIsPendingDeletionsModalOpen(true)}
        isFilterBarOpen={isFilterBarOpen}
        onToggleFilterBar={() => setIsFilterBarOpen((prev) => !prev)}
        hasActiveFilters={hasActiveFilters}
        onOpenPasswordPrompt={() => {
          setPendingAuthAction(null);
          setAuthActionDescription('habilitar permisos de edición');
          setIsPasswordPromptOpen(true);
        }}
        onOpenChangePassword={() => handleOpenChangePassword()}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        totalReservas={reservations.length}
        conflictsCount={conflicts.length}
        currentUser={currentUser}
        onLogout={handleLogout}
        isFirebaseConnected={isFirebaseConnected}
        isFirebaseSyncing={isFirebaseSyncing}
        lastSyncTime={lastSyncTime ? new Date(lastSyncTime) : null}
        onRetrySync={async () => {
          try {
            const res = await handleSyncAllToFirebase();
            if (res && !res.error) {
              triggerSyncToast('Sincronización con la nube completada con éxito', 'success');
            } else if (res?.error) {
              triggerSyncToast(res.error, 'error');
            }
          } catch (err: any) {
            triggerSyncToast(err?.message || 'Error al conectar con Firestore', 'error');
          }
        }}
      />

      {/* Filter and Search Bar - Kept hidden by default, toggled via Navbar or active filter ribbon */}
      {currentView !== 'admin' && isFilterBarOpen && (
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={() =>
            setFilters({
              search: '',
              espacio: '',
              tipoActividad: '',
              fechaDesde: '',
              fechaHasta: '',
              soloRecurrentes: false,
              soloImportantes: false,
              soloConTopamiento: false
            })
          }
          onClose={() => setIsFilterBarOpen(false)}
          totalFiltered={filteredReservations.length}
          totalAll={reservations.length}
          conflictsCount={conflicts.length}
          availableSpaces={spaces}
          availableActivityTypes={activityTypes}
        />
      )}

      {/* Subtle indicator banner when filters are active but panel is kept hidden */}
      {currentView !== 'admin' && !isFilterBarOpen && hasActiveFilters && (
        <div className="bg-blue-50/95 border-b border-blue-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 animate-fadeIn shadow-2xs">
          <div className="flex items-center space-x-2 text-blue-900 font-medium">
            <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Filtros activos aplicados ({filteredReservations.length} de {reservations.length} reservas)
            </span>
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={() => setIsFilterBarOpen(true)}
              className="text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer text-xs"
            >
              Abrir panel de filtros
            </button>
            <span className="text-blue-300">|</span>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  search: '',
                  espacio: '',
                  tipoActividad: '',
                  fechaDesde: '',
                  fechaHasta: '',
                  soloRecurrentes: false,
                  soloImportantes: false,
                  soloConTopamiento: false
                })
              }
              className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer text-xs"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      )}

      {/* Revalidation Banner for cloud synchronization feedback */}
      <RevalidationBanner isRevalidating={isFirebaseSyncing} />

      {/* Main View Area */}
      <main className={`flex-1 w-full mx-auto ${
        currentView === 'calendar' || currentView === 'daily' || currentView === 'timeline' || currentView === 'mobile'
          ? 'max-w-none px-1.5 sm:px-3 lg:px-4 py-1.5'
          : 'max-w-[1680px] px-3 sm:px-4 md:px-6 py-4'
      }`}>
        {/* Banner de Recuperación de Borrador de Reserva tras Recarga Accidental */}
        {activeDraft && !isReservationModalOpen && (
          <div
            id="app-active-draft-banner"
            className="mb-3 p-2.5 sm:p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-xs flex flex-wrap items-center justify-between gap-2 animate-fadeIn"
          >
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-amber-200 text-amber-900 shrink-0">
                <RotateCcw className="w-4 h-4 text-amber-800" />
              </div>
              <div className="text-xs text-amber-950">
                <span className="font-bold">
                  Borrador de reserva no guardado ({activeDraft.timeAgo}):
                </span>
                <span className="text-amber-900 ml-1">
                  Tenías una reserva en progreso ({activeDraft.summaryLabel}). ¿Deseas reanudar tu edición?
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-app-resume-draft"
                onClick={() => {
                  if (activeDraft.isEditing && activeDraft.targetId) {
                    const target = reservations.find((r) => r.id === activeDraft.targetId);
                    if (target) {
                      setEditingReservation(target);
                      setIsDuplicating(false);
                      setIsReservationModalOpen(true);
                      return;
                    }
                  }
                  openCreateModal();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Continuar editando</span>
              </button>
              <button
                type="button"
                id="btn-app-discard-draft"
                onClick={() => {
                  removeStoredDraft(activeDraft.key);
                  setActiveDraft(null);
                }}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-800 hover:text-amber-950 hover:bg-amber-100 transition cursor-pointer"
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Banner de Solicitudes de Eliminación en Espera (Para Administradores y Coordinadores) */}
        {isCoordinatorOrAdmin(currentUser) && pendingReservations.length > 0 && currentView !== 'admin' && (
          <div className="mb-3 p-2.5 sm:p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-xs flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-amber-200 text-amber-900 shrink-0">
                <Clock className="w-4 h-4 text-amber-800" />
              </div>
              <div className="text-xs text-amber-950">
                <span className="font-bold">
                  {pendingReservations.length === 1
                    ? 'Hay 1 solicitud de eliminación de reserva en espera de autorización.'
                    : `Hay ${pendingReservations.length} solicitudes de eliminación de reservas en espera de autorización.`}
                </span>
                <span className="hidden sm:inline text-amber-900 ml-1">
                  Requiere revisión y aprobación de un Administrador o Coordinador.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPendingDeletionsModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Revisar Solicitudes</span>
              <span className="bg-white text-amber-900 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {pendingReservations.length}
              </span>
            </button>
          </div>
        )}

        {currentView === 'calendar' && (
          isInitialLoading ? (
            <CalendarSkeleton />
          ) : (
            <CalendarView
              reservations={filteredReservations}
              spaces={spaces}
              selectedDate={selectedDailyDate}
              spaceBlocks={spaceBlocks}
              onNavigateToDay={(day) => {
                setSelectedDailyDate(day);
                if (isMobileDevice()) {
                  setCurrentView('mobile');
                } else {
                  setCurrentView('daily');
                }
              }}
              onSelectReservation={handleCalendarSelectReservation}
              onNewReservationForDate={handleCalendarNewReservationForDate}
            />
          )
        )}

        {(currentView === 'timeline' || currentView === 'daily') && (
          isInitialLoading ? (
            <TimelineSkeleton />
          ) : (
            <DailyUsageView
              reservations={filteredReservations}
              allReservations={reservations}
              conflictReservationIds={conflictReservationIds}
              globalFilters={filters}
              onFilterChange={setFilters}
              onClearGlobalFilters={() =>
                setFilters({
                  search: '',
                  espacio: '',
                  tipoActividad: '',
                  fechaDesde: '',
                  fechaHasta: '',
                  soloRecurrentes: false,
                  soloImportantes: false,
                  soloConTopamiento: false
                })
              }
              spaces={spaces}
              initialDate={selectedDailyDate}
              onDateChange={(date) => setSelectedDailyDate(date)}
              spaceBlocks={spaceBlocks}
              onNavigateToMaintenance={() => {
                setAdminSubTab('maintenance');
                requireAuth(() => setCurrentView('admin'), 'acceder a mantención');
              }}
              onSelectReservation={(r) => {
                setSelectedReservation(r);
                setIsDetailModalOpen(true);
              }}
              onDuplicateReservation={(r) => {
                handleDuplicateReservation(r);
              }}
              onEditReservation={(r) => {
                requireAuth(() => {
                  setEditingReservation(r);
                  setIsDuplicating(false);
                  setIsReservationModalOpen(true);
                }, 'editar esta reserva');
              }}
              onDeleteReservation={(id, isSeries, seriesId) => {
                requireAuth(() => handleDelete(id, isSeries, seriesId), 'eliminar esta reserva');
              }}
              onRequestDelete={(r) => {
                requireAuth(() => handleRequestDelete(r), 'eliminar esta reserva');
              }}
              onNewReservationWithSlot={(space, date, start, end) => {
                requireAuth(() => {
                  setEditingReservation(null);
                  setIsDuplicating(false);
                  setPrefillSpace(space);
                  setPrefillDate(date);
                  setPrefillStartTime(start);
                  setPrefillEndTime(end);
                  setIsReservationModalOpen(true);
                }, 'crear una reserva en este horario');
              }}
              onUpdateReservation={(reserva) => {
                requireAuth(() => handleCreateOrUpdate(reserva), 'actualizar esta reserva');
              }}
              onReorderSpaces={(newSpaces) => {
                requireAuth(() => handleReorderSpaces(newSpaces), 'reordenar espacios');
              }}
            />
          )
        )}

        {currentView === 'mobile' && (
          isInitialLoading ? (
            <TimelineSkeleton />
          ) : (
            <MobileAgendaView
              reservations={filteredReservations}
              allReservations={reservations}
              conflictReservationIds={conflictReservationIds}
              spaces={spaces}
              spaceBlocks={spaceBlocks}
              selectedDate={selectedDailyDate}
              onDateChange={(date) => setSelectedDailyDate(date)}
              onSelectReservation={(r) => {
                setSelectedReservation(r);
                setIsDetailModalOpen(true);
              }}
              onEditReservation={(r) => {
                requireAuth(() => {
                  setEditingReservation(r);
                  setIsDuplicating(false);
                  setIsReservationModalOpen(true);
                }, 'editar esta reserva');
              }}
              onDuplicateReservation={(r) => {
                handleDuplicateReservation(r);
              }}
              onDeleteReservation={(id, isSeries, seriesId) => {
                requireAuth(() => handleDelete(id, isSeries, seriesId), 'eliminar esta reserva');
              }}
              onRequestDelete={(r) => {
                requireAuth(() => handleRequestDelete(r), 'eliminar esta reserva');
              }}
              onNewReservationForDate={(dateStr, space) => {
                requireAuth(() => {
                  setEditingReservation(null);
                  setIsDuplicating(false);
                  if (space) setPrefillSpace(space);
                  setPrefillDate(dateStr);
                  setPrefillStartTime('09:00');
                  setPrefillEndTime('10:30');
                  setIsReservationModalOpen(true);
                }, 'crear una reserva en esta fecha');
              }}
              onToggleRealizada={(r) => {
                if (!currentUser) {
                  setPendingAuthAction(() => () => handleQuickToggleRealizada(r));
                  setAuthActionDescription('actualizar estado de asistencia');
                  setIsPasswordPromptOpen(true);
                  return;
                }
                requireAuth(() => handleQuickToggleRealizada(r), 'actualizar asistencia de reserva');
              }}
              onOpenRating={(r, rating) => {
                handleOpenRatingModal(r, rating);
              }}
              ratings={ratings}
              currentUser={currentUser}
              onSwitchToDesktopView={() => {
                persistViewPreference('daily');
                setCurrentView('daily');
              }}
            />
          )
        )}

        {currentView === 'spaces' && (
          <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Cargando panel de espacios...</div>}>
            <SpaceDashboard
              reservations={reservations}
              spaces={spaces}
              onSelectSpace={(spaceName) => {
                setFilters({ ...filters, espacio: spaceName });
                if (isMobileDevice()) {
                  setCurrentView('mobile');
                } else {
                  setCurrentView('daily');
                }
              }}
              onNewReservationForSpace={(spaceName) => {
                requireAuth(() => {
                  setEditingReservation(null);
                  setIsDuplicating(false);
                  setPrefillSpace(spaceName);
                  setPrefillDate(format(new Date(), 'yyyy-MM-dd'));
                  setPrefillStartTime('10:00');
                  setPrefillEndTime('11:00');
                  setIsReservationModalOpen(true);
                }, 'crear una reserva en este espacio');
              }}
              onSelectReservation={(r) => {
                setSelectedReservation(r);
                setIsDetailModalOpen(true);
              }}
            />
          </Suspense>
        )}

        {currentView === 'analytics' && (
          <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Cargando módulo de analíticas avanzadas...</div>}>
            <AnalyticsView reservations={reservations} />
          </Suspense>
        )}

        {currentView === 'ratings' && (
          <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Cargando evaluaciones y satisfacción...</div>}>
            <RatingsDashboardView
              reservations={reservations}
              ratings={ratings}
              currentUser={currentUser}
              onOpenRatingModal={handleOpenRatingModal}
              onDeleteRating={handleDeleteRating}
            />
          </Suspense>
        )}

        {currentView === 'conflicts' && (
          <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Analizando topamientos y conflictos...</div>}>
            <ConflictsView
              reservations={reservations}
              spaceBlocks={spaceBlocks}
              onSelectReservation={(r) => {
                setSelectedReservation(r);
                setIsDetailModalOpen(true);
              }}
              onEditReservation={(r) => {
                requireAuth(() => {
                  setEditingReservation(r);
                  setIsReservationModalOpen(true);
                }, 'editar esta reserva');
              }}
            />
          </Suspense>
        )}

        {(currentView === 'admin' || currentView === 'directory' || currentView === 'maintenance') && (
          <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Cargando panel de administración...</div>}>
            <AdminView
              spaces={spaces}
              loanTypes={loanTypes}
              activityTypes={activityTypes}
              equipmentList={equipment}
              users={userAccounts}
              currentUser={currentUser}
              reservations={reservations}
              spaceBlocks={spaceBlocks}
              ratings={ratings}
              initialTab={currentView === 'directory' ? 'applicants' : currentView === 'maintenance' ? 'maintenance' : adminSubTab}
              onTabChange={setAdminSubTab}
              onLogout={handleLogout}
              onSaveSpace={(space) => requireAuth(() => handleSaveSpace(space), 'guardar espacio')}
              onDeleteSpace={(id) => requireAuth(() => handleDeleteSpace(id), 'eliminar espacio')}
              onSaveLoanType={(loan) => requireAuth(() => handleSaveLoanType(loan), 'guardar tipo de préstamo')}
              onDeleteLoanType={(id) => requireAuth(() => handleDeleteLoanType(id), 'eliminar tipo de préstamo')}
              onSaveActivityType={(act) => requireAuth(() => handleSaveActivityType(act), 'guardar tipo de actividad')}
              onDeleteActivityType={(id) => requireAuth(() => handleDeleteActivityType(id), 'eliminar tipo de actividad')}
              onSaveEquipment={(item) => requireAuth(() => handleSaveEquipment(item), 'guardar equipamiento')}
              onDeleteEquipment={(id) => requireAuth(() => handleDeleteEquipment(id), 'eliminar equipamiento')}
              onResetEquipment={() => requireAuth(handleResetEquipment, 'restablecer inventario de equipamiento')}
              onSaveUser={(user, orig) => requireAuth(() => handleSaveUser(user, orig), 'guardar usuario')}
              onDeleteUser={(username) => {
                let res: { success: boolean; message?: string } = { success: false, message: '' };
                requireAuth(() => {
                  res = handleDeleteUser(username);
                }, 'eliminar usuario');
                return res;
              }}
              onResetUsers={() => requireAuth(handleResetUsers, 'restablecer usuarios')}
              onResetDefaults={() => requireAuth(handleResetDefaults, 'restablecer configuración')}
              onReorderSpaces={(newSpaces) => requireAuth(() => handleReorderSpaces(newSpaces), 'reordenar espacios')}
              onDeleteAllHolidays={handleDeleteAllHolidays}
              onOpenChangePassword={(usr) => handleOpenChangePassword(usr)}
              onOpenImportExport={() => setIsImportExportModalOpen(true)}
              onSaveBlock={async (block) => {
                requireAuth(async () => {
                  await handleSaveBlock(block);
                }, 'guardar bloqueo de espacio');
              }}
              onDeleteBlock={async (id) => {
                requireAuth(async () => {
                  await handleDeleteBlock(id);
                }, 'eliminar bloqueo de espacio');
              }}
              onSelectReservation={(r) => {
                setSelectedReservation(r);
                setIsDetailModalOpen(true);
              }}
              onNewReservationForApplicant={(applicant) => {
                requireAuth(() => {
                  setEditingReservation(null);
                  setIsDuplicating(false);
                  setPrefillSpace(applicant.espaciosMasUsados?.[0]?.espacio || '');
                  setPrefillDate(format(new Date(), 'yyyy-MM-dd'));
                  setPrefillStartTime('10:00');
                  setPrefillEndTime('11:00');
                  setPrefillResponsable(applicant.responsable || '');
                  setPrefillRut(applicant.rut || '');
                  setPrefillPhone(applicant.telefonoContacto || '');
                  setPrefillEmail(applicant.emailContacto || '');
                  setIsReservationModalOpen(true);
                }, 'crear una reserva para este solicitante');
              }}
              onOpenGmailDispatch={(date) => openGmailDispatchModal(date)}
              onSaveReservation={async (reserva, generateSeries, explicitSlots, updateWholeSeries) => {
                let success = false;
                await requireAuth(async () => {
                  success = await handleCreateOrUpdate(reserva, generateSeries, explicitSlots, updateWholeSeries);
                }, 'guardar actividad recurrente');
                return success;
              }}
              onDeleteReservation={async (id, seriesId) => {
                await requireAuth(async () => {
                  await handleDelete(id, !!seriesId, seriesId);
                }, 'eliminar actividad recurrente');
              }}
              onEditReservation={(r) => {
                requireAuth(() => {
                  setEditingReservation(r);
                  setIsReservationModalOpen(true);
                }, 'editar reserva');
              }}
            />
          </Suspense>
        )}
      </main>

      {/* Application Footer with 'Última actualización: [Fecha/Hora]' */}
      <AppFooter
        lastSyncTime={lastSyncTime}
        isSyncing={isFirebaseSyncing}
        isFirebaseConnected={isFirebaseConnected}
        totalReservations={reservations.length}
        onManualSync={async () => {
          try {
            const res = await handleSyncAllToFirebase();
            if (res && !res.error) {
              triggerSyncToast('Sincronización con la nube completada con éxito', 'success');
            } else if (res?.error) {
              triggerSyncToast(res.error, 'error');
            }
          } catch (err: any) {
            triggerSyncToast(err?.message || 'Error al conectar con Firestore', 'error');
          }
        }}
      />

      {/* Modals */}
      {isReservationModalOpen && (
        <ReservationModal
          isOpen={isReservationModalOpen}
          onClose={() => {
            setIsReservationModalOpen(false);
            setEditingReservation(null);
            setIsDuplicating(false);
            setPrefillDate('');
            setPrefillSpace('');
            setPrefillStartTime('10:00');
            setPrefillEndTime('11:00');
            setPrefillResponsable('');
            setPrefillRut('');
            setPrefillPhone('');
            setPrefillEmail('');
          }}
          onSave={handleCreateOrUpdate}
          onDelete={handleDelete}
          onRequestDelete={handleRequestDelete}
          editingReservation={editingReservation}
          isDuplicating={isDuplicating}
          onDuplicateReservation={handleDuplicateReservation}
          allReservations={reservations}
          availableSpaces={spaces}
          availableLoanTypes={loanTypes}
          availableActivityTypes={activityTypes}
          availableEquipment={equipment}
          ratings={ratings}
          spaceBlocks={spaceBlocks}
          currentUser={currentUser}
          initialDate={prefillDate}
          initialSpace={prefillSpace}
          initialStartTime={prefillStartTime}
          initialEndTime={prefillEndTime}
          initialResponsable={prefillResponsable}
          initialRut={prefillRut}
          initialPhone={prefillPhone}
          initialEmail={prefillEmail}
        />
      )}

      {isDetailModalOpen && (
        <ReservationDetailModal
          isOpen={isDetailModalOpen}
          reservation={selectedReservation}
          allReservations={reservations}
          currentUser={currentUser}
          existingRating={
            selectedReservation
              ? ratings.find((rt) => rt.reservationId === selectedReservation.id) || null
              : null
          }
          onOpenRatingModal={handleOpenRatingModal}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedReservation(null);
          }}
          onUpdateReservation={async (updated) => {
            if (!isCoordinatorOrAdmin(currentUser)) {
              triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para modificar reservas.', 'error');
              return;
            }
            setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setSelectedReservation(updated);
            await saveReservation(updated);
          }}
          onEdit={(r) => {
            if (!isCoordinatorOrAdmin(currentUser)) {
              triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para editar reservas.', 'error');
              return;
            }
            requireAuth(() => {
              setEditingReservation(r);
              setIsDuplicating(false);
              setPrefillDate(r.fecha);
              setPrefillSpace(r.espacio);
              setPrefillStartTime(r.horaInicio || '10:00');
              setPrefillEndTime(r.horaFin || '11:00');
              setIsReservationModalOpen(true);
            }, 'editar esta reserva');
          }}
          onDuplicate={(r) => {
            handleDuplicateReservation(r);
          }}
          onDelete={(id, isSeries, seriesId) => {
            if (!isCoordinatorOrAdmin(currentUser)) {
              const target = reservations.find((r) => r.id === id);
              if (target) handleRequestDelete(target);
              return;
            }
            requireAuth(() => handleDelete(id, isSeries, seriesId), 'eliminar esta reserva');
          }}
          onRequestDelete={(r) => {
            handleRequestDelete(r);
          }}
          onAuthorizeDelete={handleAuthorizeDelete}
          onRejectDeleteRequest={handleRejectDeleteRequest}
          onToggleRealizada={(reserva) => {
            if (!isCoordinatorOrAdmin(currentUser)) {
              triggerSyncToast('Permiso denegado: Solo los usuarios con perfil Administrador o Coordinador están autorizados para modificar reservas.', 'error');
              return;
            }
            requireAuth(() => handleQuickToggleRealizada(reserva), 'actualizar asistencia de reserva');
          }}
        />
      )}

      {/* Container modularizado para todos los modales auxiliares de la aplicación */}
      <AppModalsContainer
        currentUser={currentUser}
        reservations={reservations}
        spaces={spaces}
        activityTypes={activityTypes}
        loanTypes={loanTypes}
        isRatingModalOpen={isRatingModalOpen}
        ratingTargetReservation={ratingTargetReservation}
        editingRating={editingRating}
        onCloseRatingModal={() => {
          setIsRatingModalOpen(false);
          setRatingTargetReservation(null);
          setEditingRating(null);
        }}
        onSaveRating={handleSaveRating}
        isDeleteModalOpen={isDeleteModalOpen}
        deleteTargetReservation={deleteTargetReservation}
        onCloseDeleteModal={() => {
          setIsDeleteModalOpen(false);
          setDeleteTargetReservation(null);
        }}
        onConfirmDeleteSingle={handleConfirmDeleteSingle}
        onConfirmDeleteSeries={handleConfirmDeleteSeries}
        onClearParticipants={handleClearParticipants}
        onSubmitDeleteRequest={handleSubmitDeleteRequest}
        onAuthorizeDelete={handleAuthorizeDelete}
        onRejectDeleteRequest={handleRejectDeleteRequest}
        isPendingDeletionsModalOpen={isPendingDeletionsModalOpen}
        pendingReservations={pendingReservations}
        onClosePendingDeletionsModal={() => setIsPendingDeletionsModalOpen(false)}
        onSelectPendingReservation={(res) => {
          setSelectedReservation(res);
          setIsDetailModalOpen(true);
        }}
        isImportExportModalOpen={isImportExportModalOpen}
        onCloseImportExportModal={() => setIsImportExportModalOpen(false)}
        onImportReservations={handleImportReservations}
        onSyncAllToFirebase={handleSyncAllToFirebase}
        onRestoreFromBackup={(restored) => {
          setReservations(restored);
        }}
        isAuditLogOpen={isAuditLogOpen}
        auditLogs={auditLogs}
        onCloseAuditLog={() => setIsAuditLogOpen(false)}
        onReservationsChanged={async () => {
          const fresh = getLocalCache();
          setReservations(fresh);
        }}
        conflictReportData={conflictReportData}
        onCloseConflictReport={() => setConflictReportData((prev) => ({ ...prev, isOpen: false }))}
        isGlobalPrintModalOpen={isGlobalPrintModalOpen}
        globalPrintInitialDate={globalPrintInitialDate}
        onClosePrintModal={() => {
          setIsGlobalPrintModalOpen(false);
          setGlobalPrintInitialDate(undefined);
        }}
        isNotificationCenterOpen={isNotificationCenterOpen}
        onCloseNotificationCenter={() => setIsNotificationCenterOpen(false)}
        onNavigateToView={(view) => setCurrentView(view)}
        onSelectReservationFromNotification={(resId) => {
          const found = reservations.find((r) => r.id === resId);
          if (found) {
            setSelectedReservation(found);
            setIsDetailModalOpen(true);
          }
        }}
        isPasswordPromptOpen={isPasswordPromptOpen}
        authActionDescription={authActionDescription}
        onClosePasswordPrompt={() => {
          setIsPasswordPromptOpen(false);
          setPendingAuthAction(null);
        }}
        onAuthSuccess={handleAuthSuccess}
        isChangePasswordOpen={isChangePasswordOpen}
        passwordTargetUser={passwordTargetUser}
        onCloseChangePassword={() => {
          setIsChangePasswordOpen(false);
          setPasswordTargetUser(null);
        }}
        onPasswordChanged={(updatedUser) => {
          const freshUsers = getAllAuthorizedUsers();
          setUserAccounts(freshUsers);
          if (
            updatedUser &&
            currentUser &&
            updatedUser.username.toLowerCase() === currentUser.username.toLowerCase()
          ) {
            setCurrentUser(updatedUser);
            saveAuthUser(updatedUser);
          }
        }}
        isGmailDispatchModalOpen={isGmailDispatchModalOpen}
        gmailDispatchInitialDate={gmailDispatchInitialDate}
        onCloseGmailDispatch={() => {
          setIsGmailDispatchModalOpen(false);
          setGmailDispatchInitialDate(undefined);
        }}
      />

      {/* Global Quick Search & Command Palette (Ctrl+K / Cmd+K / /) */}
      <GlobalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        reservations={reservations}
        spaces={spaces}
        onSelectReservation={(r) => {
          setSelectedReservation(r);
          setIsDetailModalOpen(true);
        }}
        onNavigateToView={(view) => setCurrentView(view)}
        onNewReservation={() => openCreateModal({ date: format(selectedDailyDate || new Date(), 'yyyy-MM-dd') })}
        onOpenPrintModal={() => setIsGlobalPrintModalOpen(true)}
        onOpenGmailDispatch={() => openGmailDispatchModal()}
        onOpenAuditLog={() => {
          if (!isCoordinatorOrAdmin(currentUser)) {
            triggerSyncToast('El sistema de restauración de cambios está disponible únicamente para Administradores y Coordinadores.', 'warning');
            return;
          }
          setIsAuditLogOpen(true);
        }}
        onOpenImportExport={() => {
          requireAuth(() => setIsImportExportModalOpen(true), 'gestionar copias de seguridad');
        }}
        onNavigateToDate={(date) => {
          setSelectedDailyDate(date);
          setCurrentView('daily');
        }}
        onFilterBySpace={(spaceName) => {
          setFilters((prev) => ({ ...prev, espacio: spaceName }));
          if (!isFilterBarOpen) setIsFilterBarOpen(true);
        }}
        onFilterByApplicant={(nameOrRut) => {
          setFilters((prev) => ({ ...prev, search: nameOrRut }));
          if (!isFilterBarOpen) setIsFilterBarOpen(true);
        }}
        onClearFilters={() => {
          setFilters({
            search: '',
            espacio: '',
            tipoActividad: '',
            fechaDesde: '',
            fechaHasta: '',
            soloRecurrentes: false,
            soloImportantes: false,
            soloConTopamiento: false
          });
          triggerSyncToast('Filtros restablecidos', 'info');
        }}
        conflictsCount={conflicts.length}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Instant Sync Status Toast */}
      {syncStatusToast && (
        <div
          id="sync-status-toast"
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 left-5 z-[70] max-w-md px-4 py-3 rounded-xl shadow-2xl border flex items-start space-x-3 text-xs sm:text-sm font-semibold backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto ${
            syncStatusToast.type === 'success'
              ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/50 shadow-emerald-950/20'
              : syncStatusToast.type === 'error'
              ? 'bg-rose-950/95 text-rose-100 border-rose-600/50 shadow-rose-950/30'
              : syncStatusToast.type === 'warning'
              ? 'bg-slate-900/95 text-amber-200 border-amber-500/50 shadow-amber-950/30'
              : 'bg-slate-900/95 text-sky-200 border-sky-500/50 shadow-slate-950/20'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
              syncStatusToast.type === 'success'
                ? 'bg-emerald-400 animate-pulse'
                : syncStatusToast.type === 'error'
                ? 'bg-rose-400 animate-ping'
                : syncStatusToast.type === 'warning'
                ? 'bg-amber-400'
                : 'bg-sky-400'
            }`}
          />
          <span className="flex-1 whitespace-pre-line leading-relaxed">{syncStatusToast.message}</span>
          <button
            type="button"
            onClick={() => setSyncStatusToast(null)}
            className="text-slate-400 hover:text-white p-1 ml-1 cursor-pointer"
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      )}

      {/* Floating Notification Toast for Automated 15-day Backups */}
      {backupToast && backupToast.show && (
        <div
          id="auto-backup-toast"
          className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/40 flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
              <span>{backupToast.title}</span>
            </h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              {backupToast.message}
            </p>
            {backupToast.backupId && (
              <div className="text-[10px] font-mono text-emerald-400/80 mt-1">
                ID Respaldo: {backupToast.backupId}
              </div>
            )}
          </div>
          <button
            onClick={() => setBackupToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

