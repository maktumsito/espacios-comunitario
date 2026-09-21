import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Reservation, SpaceInfo, LoanType, ActivityTypeItem, SpaceRating, EquipmentItem, isSingleDayMultiSpaceReservation, SpaceBlock } from '../types';
import { SPACES_LIST, ACTIVITY_TYPES, normalizeSpaceName } from '../data/spacesData';
import { DEFAULT_LOAN_TYPES } from '../services/adminConfigService';
import { getStoredEquipment } from '../services/equipmentService';
import { EquipmentSelector } from './EquipmentSelector';
import { checkSingleConflict, timeToMinutes, formatMinutesToTime } from '../utils/conflictDetector';
import { AuthUser, isCoordinatorOrAdmin } from '../services/authService';
import {
  validateRut,
  validateEmail,
  validatePhone,
  validateTimeRange,
  timeStringToMinutes,
  checkLoanScheduleLimit,
  EXTENSION_AUTH_KEY,
  validateActivityDescription,
  checkSpaceCapacityWarning,
  MAX_ACTIVITY_DESCRIPTION_LENGTH
} from '../utils/validationUtils';
import { validateReservationWithZod } from '../schemas/reservationSchema';
import { checkSpaceBlocked } from '../services/spaceBlockService';
import { getResponsibleHistoryAlert } from '../services/ratingService';
import {
  getChileanHolidayInfo,
  filterOutChileanHolidays,
  verifyHolidayOverrideKey
} from '../utils/holidayUtils';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Trash2,
  Repeat,
  ChevronRight,
  ChevronLeft,
  Check,
  RefreshCw,
  Star,
  Smartphone,
  FileSignature,
  Copy,
  Layers,
  Lock,
  CalendarRange,
  ArrowRightCircle,
  CheckSquare,
  ListFilter,
  Info,
  Building2,
  RotateCcw,
  History,
  User,
  ArrowRight,
  ArrowLeft,
  SlidersHorizontal
} from 'lucide-react';
import { useReservationAutosave, AutosavedReservationDraft } from '../hooks/useReservationAutosave';
import { CommitmentLetterModal } from './CommitmentLetterModal';
import { SpaceAvailabilityTimeline } from './SpaceAvailabilityTimeline';
import { ApplicantContactSection } from './ApplicantContactSection';
import { RecurrenceScheduleSection, WEEKDAYS, type CustomScheduleSlot } from './RecurrenceScheduleSection';
export type { CustomScheduleSlot };
import { downloadCommitmentLetterPdf, isCommitmentLetterEligible } from '../utils/commitmentLetterPdf';
import { UpdateScope, BatchUpdateInfo } from '../types';
import { ConflictRecommendationPanel } from './ConflictRecommendationPanel';
import { ConflictResolutionModal, type ConflictSavePayload } from './ConflictResolutionModal';
import { ConfirmationModal } from './common/ConfirmationModal';
import { WizardStepsBar } from './WizardStepsBar';
import { ReservationStep3Details } from './ReservationStep3Details';
import { ReservationConflictBanner } from './ReservationConflictBanner';
import { RecurringSeriesScopeSelector } from './RecurringSeriesScopeSelector';
import { ReservationStep1DateTime } from './ReservationStep1DateTime';
import { ReservationStep2Applicant } from './ReservationStep2Applicant';
import { ReservationModalFooter } from './ReservationModalFooter';
import { ReservationModalHeader } from './ReservationModalHeader';
import { ReservationModalAlerts } from './ReservationModalAlerts';
import { ReservationModalDialogs, type DeleteConfirmModalState } from './ReservationModalDialogs';
import { useReservationCustomSchedules } from '../hooks/useReservationCustomSchedules';
import {
  ConflictRecommendation,
  findAvailableTimeSlotsInSpace,
  findAlternativeFreeSpaces
} from '../utils/conflictRecommender';
import {
  addDays,
  addMonths,
  startOfMonth,
  format,
  parseISO
} from 'date-fns';
import { formatDateDDMMYYYY, getDayOfWeekFromDateString, generateRecurrenceDates } from '../utils/dateUtils';

interface SeriesItemSlot {
  fecha: string;
  horaInicio?: string;
  horaFin?: string;
  espacio?: string;
}

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    reserva: Reservation,
    generateSeries?: boolean,
    seriesDates?: (string | SeriesItemSlot)[],
    updateWholeSeries?: boolean,
    batchUpdateInfo?: BatchUpdateInfo
  ) => void | boolean | Promise<void | boolean>;
  onDelete?: (id: string, isSeries?: boolean, seriesId?: string) => void;
  onRequestDelete?: (reserva: Reservation) => void;
  editingReservation?: Reservation | null;
  isDuplicating?: boolean;
  onDuplicateReservation?: (reserva: Reservation) => void;
  allReservations: Reservation[];
  availableSpaces?: SpaceInfo[];
  availableLoanTypes?: LoanType[];
  availableActivityTypes?: ActivityTypeItem[];
  availableEquipment?: EquipmentItem[];
  ratings?: SpaceRating[];
  spaceBlocks?: readonly SpaceBlock[];
  initialDate?: string;
  initialSpace?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialResponsable?: string;
  initialRut?: string;
  initialPhone?: string;
  initialEmail?: string;
  currentUser?: AuthUser | null;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onRequestDelete,
  editingReservation,
  isDuplicating = false,
  onDuplicateReservation,
  allReservations,
  availableSpaces = SPACES_LIST,
  availableLoanTypes = DEFAULT_LOAN_TYPES,
  availableActivityTypes,
  availableEquipment,
  ratings = [],
  spaceBlocks = [],
  initialDate,
  initialSpace,
  initialStartTime,
  initialEndTime,
  initialResponsable,
  initialRut,
  initialPhone,
  initialEmail,
  currentUser
}) => {
  const effectiveEquipment = useMemo(() => {
    return availableEquipment && availableEquipment.length > 0 ? availableEquipment : getStoredEquipment();
  }, [availableEquipment]);

  const effectiveActivityNames = availableActivityTypes
    ? availableActivityTypes.map(a => a.name)
    : ACTIVITY_TYPES;

  const defaultActName = effectiveActivityNames[0] || 'TALLER CCD';
  const defaultLoanName = availableLoanTypes[0]?.name || 'TALLER FORMATIVO CCD';

  const [formData, setFormData] = useState<Partial<Reservation>>({
    fecha: initialDate || format(new Date(), 'yyyy-MM-dd'),
    horaInicio: initialStartTime || '10:00',
    horaFin: initialEndTime || '11:00',
    espacio: initialSpace || (availableSpaces[0]?.name || 'TATAMI'),
    responsable: initialResponsable || '',
    telefonoContacto: initialPhone || '',
    emailContacto: initialEmail || '',
    tipoActividad: defaultActName,
    tipoPrestamo: defaultLoanName,
    descripcion: '',
    actividadRecurrente: 'No',
    diasSemana: 'lunes,miercoles',
    fechaInicioRecurrencia: initialDate || format(new Date(), 'yyyy-MM-dd'),
    fechaFinRecurrencia: format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
    cantidadParticipantes: 15,
    realizada: 'No',
    importante: 'No',
    comentarios: '',
    rut: initialRut || '',
    domicilio: '',
    equipamientoSolicitado: []
  });

  // Booking mode: 'single' (una fecha), 'specific' (fechas específicas elegidas a gusto), 'pattern' (serie semanal por días)
  const [bookingMode, setBookingMode] = useState<'single' | 'specific' | 'pattern'>('single');
  const [specificDates, setSpecificDates] = useState<string[]>([
    initialDate || format(new Date(), 'yyyy-MM-dd')
  ]);
  const [dateInputToAdd, setDateInputToAdd] = useState<string>('');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(
    startOfMonth(new Date())
  );

  const [allowConflictOverride, setAllowConflictOverride] = useState(false);
  const [showInlineSuggestions, setShowInlineSuggestions] = useState(false);
  const [generateFullSeries, setGenerateFullSeries] = useState(true);
  const [updateScope, setUpdateScope] = useState<UpdateScope>('single');
  const [rangeStartDate, setRangeStartDate] = useState<string>('');
  const [rangeEndDate, setRangeEndDate] = useState<string>('');
  const [selectedOccurrenceIds, setSelectedOccurrenceIds] = useState<Set<string>>(new Set());
  const updateWholeSeries = updateScope === 'series';
  const setUpdateWholeSeries = (val: boolean) => setUpdateScope(val ? 'series' : 'single');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3]); // Lunes y Miércoles by default
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(format(addMonths(new Date(), 3), 'yyyy-MM-dd'));

  // Progressive Wizard UX State (3 steps)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [isWizardMode, setIsWizardMode] = useState<boolean>(!editingReservation || isDuplicating);

  // Sync wizard step on open
  useEffect(() => {
    if (isOpen) {
      setWizardStep(1);
      if (!editingReservation || isDuplicating) {
        setIsWizardMode(true);
      }
    }
  }, [isOpen, editingReservation, isDuplicating]);

  // Memoized directory of past responsables and contact details for instant auto-complete and auto-fill
  const knownResponsablesMap = useMemo(() => {
    const map = new Map<string, {
      responsable: string;
      rut?: string;
      telefonoContacto?: string;
      emailContacto?: string;
      domicilio?: string;
    }>();

    (allReservations || []).forEach((r) => {
      const name = (r.responsable || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          responsable: name,
          rut: r.rut,
          telefonoContacto: r.telefonoContacto,
          emailContacto: r.emailContacto,
          domicilio: r.domicilio
        });
      } else {
        if (!existing.rut && r.rut) existing.rut = r.rut;
        if (!existing.telefonoContacto && r.telefonoContacto) existing.telefonoContacto = r.telefonoContacto;
        if (!existing.emailContacto && r.emailContacto) existing.emailContacto = r.emailContacto;
        if (!existing.domicilio && r.domicilio) existing.domicilio = r.domicilio;
      }
    });

    return map;
  }, [allReservations]);

  const uniqueResponsablesList = useMemo(() => {
    return Array.from(knownResponsablesMap.values()).sort((a, b) => a.responsable.localeCompare(b.responsable));
  }, [knownResponsablesMap]);

  const [autoFilledContactNotice, setAutoFilledContactNotice] = useState<boolean>(false);

  const handleResponsableChange = (name: string) => {
    const key = name.trim().toLowerCase();
    const matched = knownResponsablesMap.get(key);

    if (matched && (!formData.telefonoContacto || !formData.rut || !formData.emailContacto)) {
      setFormData(prev => ({
        ...prev,
        responsable: name,
        rut: prev.rut || matched.rut || '',
        telefonoContacto: prev.telefonoContacto || matched.telefonoContacto || '',
        emailContacto: prev.emailContacto || matched.emailContacto || '',
        domicilio: prev.domicilio || matched.domicilio || ''
      }));
      setAutoFilledContactNotice(true);
      setTimeout(() => setAutoFilledContactNotice(false), 4500);
    } else {
      setFormData(prev => ({ ...prev, responsable: name }));
    }
  };

  // Hallazgo 1: Conflict dialog & async check state (prevents UI freeze and deadlock)
  const [showConflictDialog, setShowConflictDialog] = useState<boolean>(false);
  const [isCheckingConflictAsync, setIsCheckingConflictAsync] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Hallazgo 3: Concurrency detection & snapshot
  const [dismissedConcurrency, setDismissedConcurrency] = useState<boolean>(false);
  const initialEditingSnapshot = React.useRef<{ id: string; updatedAt?: string; version?: number } | null>(null);

  useEffect(() => {
    if (editingReservation) {
      initialEditingSnapshot.current = {
        id: editingReservation.id,
        updatedAt: editingReservation.updatedAt,
        version: editingReservation.version
      };
      setDismissedConcurrency(false);
    } else {
      initialEditingSnapshot.current = null;
      setDismissedConcurrency(false);
    }
  }, [editingReservation]);

  // Non-blocking inline feedback system to replace blocking alert() calls (D4 & D9)
  const [formFeedback, setFormFeedback] = useState<{ message: string; type: 'error' | 'warning' | 'info' | 'success' } | null>(null);

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    secondaryAction?: {
      label: string;
      onClick: () => void;
      className?: string;
    };
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Eliminar',
    onConfirm: () => {}
  });

  const showFormFeedback = (message: string, type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    setFormFeedback({ message, type });
    const el = document.getElementById('modal-form-feedback-banner');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setTimeout(() => {
      setFormFeedback(prev => (prev?.message === message ? null : prev));
    }, 6000);
  };

  const concurrencyConflict = useMemo(() => {
    if (dismissedConcurrency || !editingReservation || !initialEditingSnapshot.current || !allReservations) {
      return null;
    }
    const currentInStore = allReservations.find((r) => r.id === editingReservation.id);
    if (!currentInStore) {
      return { type: 'deleted' as const, message: 'Esta reserva fue eliminada en otra sesión.' };
    }
    const initialUpdatedAt = initialEditingSnapshot.current.updatedAt;
    if (currentInStore.updatedAt && initialUpdatedAt && currentInStore.updatedAt > initialUpdatedAt) {
      return {
        type: 'modified' as const,
        editor: currentInStore.editadoPor || 'otro usuario',
        updatedAt: currentInStore.updatedAt,
        currentReservation: currentInStore
      };
    }
    return null;
  }, [allReservations, editingReservation, dismissedConcurrency]);

  // Single date multi-space state (2do espacio en diferente horario para el mismo día)
  const [enableSingleSecondSpace, setEnableSingleSecondSpace] = useState<boolean>(false);
  const [singleSecondSpace, setSingleSecondSpace] = useState<string>('');
  const [singleSecondStartTime, setSingleSecondStartTime] = useState<string>('11:00');
  const [singleSecondEndTime, setSingleSecondEndTime] = useState<string>('12:00');

  // Multi-day & Weekly pattern custom schedules hook
  const {
    useCustomSchedulesPerDate,
    setUseCustomSchedulesPerDate,
    dateSchedules,
    setDateSchedules,
    useCustomSchedulesPerDay,
    setUseCustomSchedulesPerDay,
    daySchedules,
    setDaySchedules,
    handleUpdateDateSchedule,
    handleCopyDateScheduleToAll,
    handleApplyBaseToAllDates,
    handleUpdateDaySchedule,
    handleCopyDayScheduleToAll,
    handleApplyBaseToAllDays
  } = useReservationCustomSchedules({
    formData,
    initialSpace,
    availableSpaces,
    specificDates,
    selectedDays
  });

  // Feriados en Chile & Clave de autorización CCD
  const [holidayOverrideKey, setHolidayOverrideKey] = useState<string>('');
  const [includeHolidaysInSeries, setIncludeHolidaysInSeries] = useState<boolean>(false);

  // Invalidate holiday authorization if the target date or date pattern changes
  const prevHolidayDateRef = useRef<string>(formData.fecha);
  const prevHolidaySpecificRef = useRef<string>(specificDates.join(','));
  const prevHolidayPatternRef = useRef<string>(`${recurrenceStartDate}_${recurrenceEndDate}_${selectedDays.join(',')}`);

  useEffect(() => {
    if (prevHolidayDateRef.current !== formData.fecha) {
      prevHolidayDateRef.current = formData.fecha;
      setHolidayOverrideKey('');
    }
  }, [formData.fecha]);

  useEffect(() => {
    const currentSpecific = specificDates.join(',');
    if (prevHolidaySpecificRef.current !== currentSpecific) {
      prevHolidaySpecificRef.current = currentSpecific;
      setHolidayOverrideKey('');
    }
  }, [specificDates]);

  useEffect(() => {
    const currentPattern = `${recurrenceStartDate}_${recurrenceEndDate}_${selectedDays.join(',')}`;
    if (prevHolidayPatternRef.current !== currentPattern) {
      prevHolidayPatternRef.current = currentPattern;
      setHolidayOverrideKey('');
    }
  }, [recurrenceStartDate, recurrenceEndDate, selectedDays]);

  // Clave de autorización para préstamo fuera de horario regular (ccd2026)
  const [extendedAuthKey, setExtendedAuthKey] = useState<string>('');

  // Carta de Compromiso Modal State & Ticket Switch
  const [showCommitmentLetterModal, setShowCommitmentLetterModal] = useState<boolean>(false);
  const [descargarCartaAlCrear, setDescargarCartaAlCrear] = useState<boolean>(true);

  // Local Autosave Hook: saves state to localStorage during editing and recovers progress on reload
  const handleRestoreDraft = useCallback((draft: AutosavedReservationDraft) => {
    if (draft.formData) {
      setFormData((prev) => ({
        ...prev,
        ...draft.formData
      }));
    }
    if (draft.bookingMode) setBookingMode(draft.bookingMode);
    if (draft.specificDates && draft.specificDates.length > 0) setSpecificDates(draft.specificDates);
    if (draft.selectedDays && draft.selectedDays.length > 0) setSelectedDays(draft.selectedDays);
    if (draft.recurrenceStartDate) setRecurrenceStartDate(draft.recurrenceStartDate);
    if (draft.recurrenceEndDate) setRecurrenceEndDate(draft.recurrenceEndDate);
    if (draft.useCustomSchedulesPerDate !== undefined) setUseCustomSchedulesPerDate(draft.useCustomSchedulesPerDate);
    if (draft.dateSchedules) setDateSchedules(draft.dateSchedules);
    if (draft.useCustomSchedulesPerDay !== undefined) setUseCustomSchedulesPerDay(draft.useCustomSchedulesPerDay);
    if (draft.daySchedules) setDaySchedules(draft.daySchedules);
    if (draft.enableSingleSecondSpace !== undefined) setEnableSingleSecondSpace(draft.enableSingleSecondSpace);
    if (draft.singleSecondSpace) setSingleSecondSpace(draft.singleSecondSpace);
    if (draft.singleSecondStartTime) setSingleSecondStartTime(draft.singleSecondStartTime);
    if (draft.singleSecondEndTime) setSingleSecondEndTime(draft.singleSecondEndTime);
    if (draft.descargarCartaAlCrear !== undefined) setDescargarCartaAlCrear(draft.descargarCartaAlCrear);

    showFormFeedback('✓ Progreso recuperado exitosamente desde el borrador guardado automáticamente.', 'success');
  }, []);

  const {
    hasDraft,
    draftData,
    draftTimeAgo,
    isSaving: isAutosaving,
    lastSavedAt: autosaveLastSavedAt,
    restoreDraft,
    discardDraft,
    clearDraft
  } = useReservationAutosave({
    isOpen,
    editingReservation,
    isDuplicating,
    formData,
    bookingMode,
    specificDates,
    selectedDays,
    recurrenceStartDate,
    recurrenceEndDate,
    useCustomSchedulesPerDate,
    dateSchedules,
    useCustomSchedulesPerDay,
    daySchedules,
    enableSingleSecondSpace,
    singleSecondSpace,
    singleSecondStartTime,
    singleSecondEndTime,
    descargarCartaAlCrear,
    onRestore: handleRestoreDraft
  });

  // Detect if current editing reservation belongs to a recurring series (never when duplicating or single-day multi-space)
  const isEditingRecurring = useMemo(() => {
    if (isDuplicating || !editingReservation) return false;
    if (isSingleDayMultiSpaceReservation(editingReservation)) return false;
    return Boolean(
      editingReservation.actividadRecurrente === 'Sí' ||
        Boolean(editingReservation.serieRecurrente || editingReservation.recurrenteId)
    );
  }, [editingReservation, isDuplicating]);

  // Hallazgo 1: Indicates when user chose to edit ONLY the current occurrence
  const isEditingSingleOccurrence = useMemo(() => {
    return Boolean(
      editingReservation &&
      !isDuplicating &&
      isEditingRecurring &&
      updateScope === 'single'
    );
  }, [editingReservation, isDuplicating, isEditingRecurring, updateScope]);

  // All reservations in this recurring series, sorted chronologically
  const seriesReservations = useMemo<Reservation[]>(() => {
    if (!editingReservation || isDuplicating || isSingleDayMultiSpaceReservation(editingReservation)) return [];
    const sId = editingReservation.serieRecurrente || editingReservation.recurrenteId;
    if (sId && allReservations) {
      const matches = allReservations
        .filter((r) => r.serieRecurrente === sId || r.recurrenteId === sId)
        .sort((a, b) => {
          if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
          return a.horaInicio.localeCompare(b.horaInicio);
        });
      if (matches.length > 0) return matches;
    }
    if (editingReservation.actividadRecurrente === 'Sí' && allReservations) {
      const matches = allReservations
        .filter(
          (r) =>
            r.id === editingReservation.id ||
            (r.actividadRecurrente === 'Sí' &&
              r.tipoActividad === editingReservation.tipoActividad &&
              r.responsable === editingReservation.responsable &&
              r.espacio === editingReservation.espacio)
        )
        .sort((a, b) => {
          if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
          return a.horaInicio.localeCompare(b.horaInicio);
        });
      if (matches.length > 0) return matches;
    }
    return [editingReservation];
  }, [editingReservation, isDuplicating, allReservations]);

  const seriesCount = seriesReservations.length > 0 ? seriesReservations.length : (editingReservation?.totalEnSerie || (editingReservation?.actividadRecurrente === 'Sí' ? 1 : 0));

  // The subset of reservations affected based on the selected updateScope
  const affectedReservations = useMemo<Reservation[]>(() => {
    if (!editingReservation) return [];
    if (!isEditingRecurring || isDuplicating) {
      return [editingReservation];
    }
    if (updateScope === 'single') {
      return [editingReservation];
    }
    if (updateScope === 'future') {
      const refDate = editingReservation.fecha;
      const res = seriesReservations.filter((r) => r.fecha >= refDate);
      return res.length > 0 ? res : [editingReservation];
    }
    if (updateScope === 'series') {
      return seriesReservations.length > 0 ? seriesReservations : [editingReservation];
    }
    if (updateScope === 'dateRange') {
      if (!rangeStartDate || !rangeEndDate) return [];
      const minD = rangeStartDate <= rangeEndDate ? rangeStartDate : rangeEndDate;
      const maxD = rangeStartDate <= rangeEndDate ? rangeEndDate : rangeStartDate;
      const res = seriesReservations.filter((r) => r.fecha >= minD && r.fecha <= maxD);
      return res.length > 0 ? res : [];
    }
    if (updateScope === 'selected') {
      const res = seriesReservations.filter((r) => selectedOccurrenceIds.has(r.id));
      return res.length > 0 ? res : (selectedOccurrenceIds.has(editingReservation.id) ? [editingReservation] : []);
    }
    return [editingReservation];
  }, [
    editingReservation,
    isEditingRecurring,
    isDuplicating,
    updateScope,
    seriesReservations,
    rangeStartDate,
    rangeEndDate,
    selectedOccurrenceIds
  ]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingReservation) {
      const isCopy = Boolean(isDuplicating);
      const isMultiSpace = isSingleDayMultiSpaceReservation(editingReservation);
      const clonedEquip = editingReservation.equipamientoSolicitado
        ? JSON.parse(JSON.stringify(editingReservation.equipamientoSolicitado))
        : [];

      const copyDesc = isCopy
        ? (editingReservation.descripcion
            ? (editingReservation.descripcion.includes('(Copia)') ? editingReservation.descripcion : `${editingReservation.descripcion} (Copia)`)
            : `${editingReservation.tipoActividad || 'Reserva'} (Copia)`)
        : (editingReservation.descripcion || '');

      const sMinInit = timeToMinutes(editingReservation.horaInicio);
      const eMinInit = timeToMinutes(editingReservation.horaFin);
      const isNaturallyOvernight = sMinInit >= 18 * 60 && eMinInit <= sMinInit && eMinInit > 0;
      const isClearlyNormalDaytime = sMinInit >= 8 * 60 + 30 && eMinInit <= 22 * 60 && eMinInit > sMinInit;
      const initialMidnight = Boolean(
        isNaturallyOvernight ||
        (editingReservation.terminaDiaSiguiente && !isClearlyNormalDaytime)
      );

      setFormData({
        ...editingReservation,
        id: isCopy
          ? `RSV_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
          : editingReservation.id,
        descripcion: copyDesc,
        realizada: isCopy ? 'No' : (editingReservation.realizada || 'No'),
        actividadRecurrente: isCopy || isMultiSpace ? 'No' : (editingReservation.actividadRecurrente || 'No'),
        serieRecurrente: isCopy || isMultiSpace ? undefined : editingReservation.serieRecurrente,
        recurrenteId: isCopy || isMultiSpace ? undefined : editingReservation.recurrenteId,
        indiceEnSerie: isCopy ? undefined : editingReservation.indiceEnSerie,
        totalEnSerie: isCopy ? undefined : editingReservation.totalEnSerie,
        terminaDiaSiguiente: initialMidnight,
        horarioExtendidoAutorizado: false,
        claveAutorizacion: '',
        autorizadoPor: editingReservation.autorizadoPor || '',
        equipamientoSolicitado: clonedEquip
      });
      // Inicia bloqueado por defecto para requerir validación estricta de clave ccd2026
      setExtendedAuthKey('');
      setGenerateFullSeries(isCopy ? true : false);
      setAllowConflictOverride(false);
      setUpdateScope('single');
      setRangeStartDate(editingReservation.fecha || format(new Date(), 'yyyy-MM-dd'));
      setRangeEndDate(editingReservation.fecha || format(new Date(), 'yyyy-MM-dd'));
      setSelectedOccurrenceIds(new Set([editingReservation.id]));

      if (isCopy || isMultiSpace) {
        setBookingMode('single');
      } else if (editingReservation.tipoRecurrencia === 'especificas') {
        setBookingMode('specific');
      } else if (editingReservation.actividadRecurrente === 'Sí') {
        setBookingMode('pattern');
      } else {
        setBookingMode('single');
      }

      setEnableSingleSecondSpace(false);

      setDescargarCartaAlCrear(editingReservation.descargarCartaAlCrear ?? false);

      if (editingReservation.fecha) {
        setSpecificDates([editingReservation.fecha]);
        try {
          setCurrentCalendarMonth(parseISO(editingReservation.fecha));
        } catch (e) {}
      }

      // Check if editing a series: load full series context and per-day / per-date schedules
      const sId = !isCopy && !isMultiSpace && (editingReservation.serieRecurrente || editingReservation.recurrenteId);
      if (sId && allReservations) {
        const matches = allReservations.filter((r) => r.serieRecurrente === sId || r.recurrenteId === sId);
        if (matches.length > 0) {
          const sortedMatches = [...matches].sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return a.horaInicio.localeCompare(b.horaInicio);
          });
          const dates = sortedMatches.map((r) => r.fecha);
          setSpecificDates(dates);
          setRecurrenceStartDate(dates[0]);
          setRecurrenceEndDate(dates[dates.length - 1]);

          const dayMap: Record<number, { horaInicio: string; horaFin: string; espacio?: string }> = {};
          const dateMap: Record<string, { horaInicio: string; horaFin: string; espacio?: string }> = {};
          const foundDays = new Set<number>();
          let hasDifferentSchedules = false;

          sortedMatches.forEach((m) => {
            const dNum = getDayOfWeekFromDateString(m.fecha);
            foundDays.add(dNum);
            dateMap[m.fecha] = {
              horaInicio: m.horaInicio,
              horaFin: m.horaFin,
              espacio: m.espacio
            };
            if (!dayMap[dNum]) {
              dayMap[dNum] = {
                horaInicio: m.horaInicio,
                horaFin: m.horaFin,
                espacio: m.espacio
              };
            } else {
              if (
                dayMap[dNum].horaInicio !== m.horaInicio ||
                dayMap[dNum].horaFin !== m.horaFin ||
                dayMap[dNum].espacio !== m.espacio
              ) {
                hasDifferentSchedules = true;
              }
            }
          });

          const dayEntries = Object.values(dayMap);
          if (dayEntries.length > 1) {
            const first = dayEntries[0];
            if (
              dayEntries.some(
                (d) =>
                  d.horaInicio !== first.horaInicio ||
                  d.horaFin !== first.horaFin ||
                  d.espacio !== first.espacio
              )
            ) {
              hasDifferentSchedules = true;
            }
          }

          setDaySchedules((prev) => ({ ...prev, ...dayMap }));
          setDateSchedules(dateMap);
          if (hasDifferentSchedules) {
            setUseCustomSchedulesPerDay(true);
            setUseCustomSchedulesPerDate(true);
          }
          if (foundDays.size > 0) {
            setSelectedDays(Array.from(foundDays).sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)));
          }
        }
      } else {
        if (editingReservation.fechaInicioRecurrencia) {
          setRecurrenceStartDate(editingReservation.fechaInicioRecurrencia);
        } else if (editingReservation.fecha) {
          setRecurrenceStartDate(editingReservation.fecha);
        }
        if (editingReservation.fechaFinRecurrencia) {
          setRecurrenceEndDate(editingReservation.fechaFinRecurrencia);
        }
        if (editingReservation.diasSemana) {
          const raw = editingReservation.diasSemana.toLowerCase();
          const daysFound: number[] = [];
          WEEKDAYS.forEach((w) => {
            if (raw.includes(w.key) || raw.includes(String(w.dayNum))) {
              daysFound.push(w.dayNum);
            }
          });
          if (daysFound.length > 0) {
            setSelectedDays(daysFound);
          }
        }
      }
    } else {
      const defAct = effectiveActivityNames[0] || 'TALLER CCD';
      const defLoan = availableLoanTypes[0]?.name || 'TALLER FORMATIVO CCD';
      let defaultSpace = initialSpace || (availableSpaces[0]?.name || 'TATAMI');

      const initD = initialDate || format(new Date(), 'yyyy-MM-dd');
      let initDayNum = 1;
      try {
        initDayNum = parseISO(initD).getDay();
        setCurrentCalendarMonth(parseISO(initD));
      } catch (e) {
        initDayNum = 1;
      }

      // If opening fresh without a pre-chosen space, pick the first non-conflicting space if possible
      if (!initialSpace && availableSpaces.length > 1) {
        const testSlot = {
          fecha: initD,
          horaInicio: initialStartTime || '10:00',
          horaFin: initialEndTime || '11:00',
          espacio: defaultSpace
        };
        if (checkSingleConflict(testSlot, allReservations).length > 0) {
          const freeSpace = availableSpaces.find((sp) =>
            checkSingleConflict({ ...testSlot, espacio: sp.name }, allReservations).length === 0
          );
          if (freeSpace) {
            defaultSpace = freeSpace.name;
          }
        }
      }

      setFormData({
        id: `RSV_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        fecha: initD,
        horaInicio: initialStartTime || '10:00',
        horaFin: initialEndTime || '11:00',
        espacio: defaultSpace,
        responsable: initialResponsable || '',
        telefonoContacto: initialPhone || '',
        emailContacto: initialEmail || '',
        tipoActividad: defAct,
        tipoPrestamo: defLoan,
        descripcion: '',
        actividadRecurrente: 'No',
        diasSemana: 'lunes,miercoles',
        fechaInicioRecurrencia: initD,
        fechaFinRecurrencia: format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
        cantidadParticipantes: 15,
        realizada: 'No',
        importante: 'No',
        comentarios: '',
        rut: initialRut || '',
        domicilio: '',
        terminaDiaSiguiente: false,
        horarioExtendidoAutorizado: false,
        claveAutorizacion: '',
        autorizadoPor: '',
        equipamientoSolicitado: []
      });
      setBookingMode('single');
      setSpecificDates([initD]);
      setDateInputToAdd('');
      setRecurrenceStartDate(initD);
      setRecurrenceEndDate(format(addMonths(new Date(), 3), 'yyyy-MM-dd'));
      setSelectedDays([initDayNum]);
      setGenerateFullSeries(true);
      setAllowConflictOverride(false);
      setShowConflictDialog(false);
      setExtendedAuthKey('');
      setHolidayOverrideKey('');
      setEnableSingleSecondSpace(false);
      const defaultSecondSpace = availableSpaces.find((s) => s.name !== defaultSpace)?.name || availableSpaces[1]?.name || availableSpaces[0]?.name;
      setSingleSecondSpace(defaultSecondSpace);
      setSingleSecondStartTime(initialEndTime || '11:00');
      setSingleSecondEndTime('12:00');
      setUseCustomSchedulesPerDay(false);
      setUseCustomSchedulesPerDate(false);
      setDaySchedules({
        1: { horaInicio: initialStartTime || '10:00', horaFin: initialEndTime || '11:00', espacio: defaultSpace, hasSecondSlot: false, secondHoraInicio: initialEndTime || '11:00', secondHoraFin: '12:00', secondEspacio: defaultSecondSpace },
        2: { horaInicio: initialStartTime || '10:00', horaFin: initialEndTime || '11:00', espacio: defaultSpace, hasSecondSlot: false, secondHoraInicio: initialEndTime || '11:00', secondHoraFin: '12:00', secondEspacio: defaultSecondSpace },
        3: { horaInicio: initialStartTime || '10:00', horaFin: initialEndTime || '11:00', espacio: defaultSpace, hasSecondSlot: false, secondHoraInicio: initialEndTime || '11:00', secondHoraFin: '12:00', secondEspacio: defaultSecondSpace },
        4: { horaInicio: initialStartTime || '10:00', horaFin: initialEndTime || '11:00', espacio: defaultSpace, hasSecondSlot: false, secondHoraInicio: initialEndTime || '11:00', secondHoraFin: '12:00', secondEspacio: defaultSecondSpace },
        5: { horaInicio: initialStartTime || '10:00', horaFin: initialEndTime || '11:00', espacio: defaultSpace, hasSecondSlot: false, secondHoraInicio: initialEndTime || '11:00', secondHoraFin: '12:00', secondEspacio: defaultSecondSpace },
        6: { horaInicio: initialStartTime || '10:00', horaFin: initialEndTime || '11:00', espacio: defaultSpace, hasSecondSlot: false, secondHoraInicio: initialEndTime || '11:00', secondHoraFin: '12:00', secondEspacio: defaultSecondSpace },
        0: { horaInicio: initialStartTime || '10:00', horaFin: initialEndTime || '11:00', espacio: defaultSpace, hasSecondSlot: false, secondHoraInicio: initialEndTime || '11:00', secondHoraFin: '12:00', secondEspacio: defaultSecondSpace }
      });
    }
  }, [editingReservation, isDuplicating, initialDate, initialSpace, initialStartTime, initialEndTime, isOpen, availableSpaces, availableLoanTypes, availableActivityTypes]);

  // Synchronize start date if primary date changes
  const handlePrimaryDateChange = (newDate: string) => {
    setFormData((prev) => ({ ...prev, fecha: newDate }));
    if (!editingReservation) {
      setRecurrenceStartDate(newDate);
      if (!specificDates.includes(newDate)) {
        setSpecificDates((prev) => Array.from(new Set([newDate, ...prev])).sort());
      }
      try {
        const parsed = parseISO(newDate);
        setCurrentCalendarMonth(parsed);
        const dayNum = parsed.getDay();
        if (!selectedDays.includes(dayNum)) {
          setSelectedDays((prev) => Array.from(new Set([...prev, dayNum])));
        }
      } catch (e) {
        // ignore
      }
    }
  };

  // Specific dates handlers
  const handleAddSpecificDate = (dateStr: string) => {
    if (!dateStr) return;
    setSpecificDates((prev) => {
      if (prev.includes(dateStr)) return prev;
      return [...prev, dateStr].sort();
    });
    // Set first date as primary if empty
    if (!formData.fecha) {
      setFormData((prev) => ({ ...prev, fecha: dateStr }));
    }
  };

  const handleRemoveSpecificDate = (dateStr: string) => {
    setSpecificDates((prev) => {
      const filtered = prev.filter((d) => d !== dateStr);
      if (filtered.length > 0 && formData.fecha === dateStr) {
        setFormData((p) => ({ ...p, fecha: filtered[0] }));
      }
      return filtered;
    });
  };

  const handleToggleSpecificDate = (dateStr: string) => {
    if (specificDates.includes(dateStr)) {
      handleRemoveSpecificDate(dateStr);
    } else {
      handleAddSpecificDate(dateStr);
    }
  };

  const handleAddRelativeDays = (daysToAdd: number) => {
    try {
      const baseStr = specificDates.length > 0 ? specificDates[specificDates.length - 1] : (formData.fecha || '2026-08-27');
      const nextDate = format(addDays(parseISO(baseStr), daysToAdd), 'yyyy-MM-dd');
      handleAddSpecificDate(nextDate);
      setCurrentCalendarMonth(parseISO(nextDate));
    } catch (e) {
      // ignore
    }
  };

  // Day toggler for pattern recurrence
  const toggleDay = (dayNum: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayNum)) {
        if (prev.length === 1) return prev; // Keep at least one day
        return prev.filter((d) => d !== dayNum);
      } else {
        return [...prev, dayNum].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
      }
    });
    setDaySchedules((prev) => {
      if (!prev[dayNum] || !prev[dayNum].espacio) {
        return {
          ...prev,
          [dayNum]: {
            horaInicio: prev[dayNum]?.horaInicio || formData.horaInicio || '10:00',
            horaFin: prev[dayNum]?.horaFin || formData.horaFin || '11:00',
            espacio: prev[dayNum]?.espacio || formData.espacio || 'TATAMI'
          }
        };
      }
      return prev;
    });
  };

  // 1. Raw Pattern Dates generator with strictly inclusive end date boundary (Hallazgo 6)
  const rawPatternDates = useMemo(() => {
    if (bookingMode !== 'pattern') return [];
    if (!recurrenceStartDate || !recurrenceEndDate) return [];
    return generateRecurrenceDates(recurrenceStartDate, recurrenceEndDate, selectedDays);
  }, [bookingMode, recurrenceStartDate, recurrenceEndDate, selectedDays]);

  // Chilean holiday analysis for pattern recurrence
  const patternHolidayAnalysis = useMemo(() => {
    return filterOutChileanHolidays(rawPatternDates);
  }, [rawPatternDates]);

  // Applicant ratings history alert (antecedentes de auxiliares de préstamos previos)
  const responsibleHistoryAlert = useMemo(() => {
    return getResponsibleHistoryAlert(formData.responsable || '', formData.telefonoContacto, ratings);
  }, [formData.responsable, formData.telefonoContacto, ratings]);

  // Chilean holiday analysis for specific dates
  const specificHolidayAnalysis = useMemo(() => {
    return filterOutChileanHolidays(specificDates);
  }, [specificDates]);

  // Validation of the special authorization key 'CCD'
  const isHolidayAuthorized = useMemo(() => {
    return verifyHolidayOverrideKey(holidayOverrideKey);
  }, [holidayOverrideKey]);

  // Effective pattern dates: omits holidays unless user requested & entered valid CCD key
  const generatedDates = useMemo(() => {
    if (bookingMode !== 'pattern') return [];
    if (includeHolidaysInSeries && isHolidayAuthorized) {
      return rawPatternDates;
    }
    return patternHolidayAnalysis.validDates;
  }, [bookingMode, includeHolidaysInSeries, isHolidayAuthorized, rawPatternDates, patternHolidayAnalysis]);

  // Single date holiday info
  const singleDateHolidayInfo = useMemo(() => {
    return getChileanHolidayInfo(formData.fecha || editingReservation?.fecha || '');
  }, [formData.fecha, editingReservation?.fecha]);

  // Real-time validations for time range, second space, RUT, Email, pattern dates, specific dates, description, and capacity warnings
  const timeValidation = useMemo(() => {
    return validateTimeRange(
      formData.horaInicio || '',
      formData.horaFin || '',
      Boolean(formData.terminaDiaSiguiente)
    );
  }, [formData.horaInicio, formData.horaFin, formData.terminaDiaSiguiente]);

  const singleSecondTimeValidation = useMemo(() => {
    if (!enableSingleSecondSpace) return { isValid: true, error: undefined };
    return validateTimeRange(singleSecondStartTime || '', singleSecondEndTime || '');
  }, [enableSingleSecondSpace, singleSecondStartTime, singleSecondEndTime]);

  const rutValidation = useMemo(() => {
    return validateRut(formData.rut || '', true);
  }, [formData.rut]);

  const emailValidation = useMemo(() => {
    return validateEmail(formData.emailContacto || '', true);
  }, [formData.emailContacto]);

  const phoneValidation = useMemo(() => {
    return validatePhone(formData.telefonoContacto || '', true);
  }, [formData.telefonoContacto]);

  const loanScheduleCheck = useMemo(() => {
    // Check main schedule
    const mainCheck = checkLoanScheduleLimit(
      formData.horaInicio || '',
      formData.horaFin || '',
      Boolean(formData.terminaDiaSiguiente)
    );
    if (mainCheck.requiresAuthorization) return mainCheck;

    // Check single second space
    if (enableSingleSecondSpace && singleSecondStartTime && singleSecondEndTime) {
      const secondCheck = checkLoanScheduleLimit(
        singleSecondStartTime,
        singleSecondEndTime,
        false
      );
      if (secondCheck.requiresAuthorization) {
        return {
          isOutsideRegularHours: true,
          requiresAuthorization: true,
          reason: `El segundo espacio (${singleSecondSpace || '2° Espacio'}) tiene horario extendido: ${secondCheck.reason}`
        };
      }
    }

    // Check custom schedules per date
    if (bookingMode === 'specific' && useCustomSchedulesPerDate) {
      for (const d of specificDates) {
        const slot = dateSchedules[d];
        if (slot) {
          const sCheck = checkLoanScheduleLimit(slot.horaInicio || '', slot.horaFin || '', false);
          if (sCheck.requiresAuthorization) {
            return {
              isOutsideRegularHours: true,
              requiresAuthorization: true,
              reason: `La fecha ${formatDateDDMMYYYY(d)} opera en horario extendido: ${sCheck.reason}`
            };
          }
          if (slot.hasSecondSlot && slot.secondHoraInicio && slot.secondHoraFin) {
            const s2Check = checkLoanScheduleLimit(slot.secondHoraInicio, slot.secondHoraFin, false);
            if (s2Check.requiresAuthorization) {
              return {
                isOutsideRegularHours: true,
                requiresAuthorization: true,
                reason: `La fecha ${formatDateDDMMYYYY(d)} (2° espacio) opera en horario extendido: ${s2Check.reason}`
              };
            }
          }
        }
      }
    }

    // Check custom schedules per day
    if (bookingMode === 'pattern' && useCustomSchedulesPerDay) {
      for (const dayNum of selectedDays) {
        const slot = daySchedules[dayNum];
        if (slot) {
          const dayName = WEEKDAYS.find(w => w.dayNum === dayNum)?.full || 'Día';
          const sCheck = checkLoanScheduleLimit(slot.horaInicio || '', slot.horaFin || '', false);
          if (sCheck.requiresAuthorization) {
            return {
              isOutsideRegularHours: true,
              requiresAuthorization: true,
              reason: `El día ${dayName} opera en horario extendido: ${sCheck.reason}`
            };
          }
        }
      }
    }

    return mainCheck;
  }, [
    formData.horaInicio,
    formData.horaFin,
    formData.terminaDiaSiguiente,
    enableSingleSecondSpace,
    singleSecondStartTime,
    singleSecondEndTime,
    singleSecondSpace,
    bookingMode,
    useCustomSchedulesPerDate,
    specificDates,
    dateSchedules,
    useCustomSchedulesPerDay,
    selectedDays,
    daySchedules
  ]);

  const isExtensionAuthorized = useMemo(() => {
    if (!loanScheduleCheck.requiresAuthorization) return true;
    // Strict real validation: extendedAuthKey must explicitly match EXTENSION_AUTH_KEY ('ccd2026').
    // Starts locked by default; empty key or admin profile alone does NOT unlock without entering the key.
    return extendedAuthKey.trim().toLowerCase() === EXTENSION_AUTH_KEY.toLowerCase();
  }, [loanScheduleCheck.requiresAuthorization, extendedAuthKey]);

  const descriptionValidation = useMemo(() => {
    return validateActivityDescription(formData.descripcion, MAX_ACTIVITY_DESCRIPTION_LENGTH);
  }, [formData.descripcion]);

  const isEditingExisting = Boolean(editingReservation && !isDuplicating);
  const canModifyReservation = isCoordinatorOrAdmin(currentUser);

  const primarySpaceCapacityWarning = useMemo(() => {
    return checkSpaceCapacityWarning(formData.espacio || '', formData.cantidadParticipantes, availableSpaces);
  }, [formData.espacio, formData.cantidadParticipantes, availableSpaces]);

  const secondSpaceCapacityWarning = useMemo(() => {
    if (!enableSingleSecondSpace || !singleSecondSpace) return null;
    return checkSpaceCapacityWarning(singleSecondSpace, formData.cantidadParticipantes, availableSpaces);
  }, [enableSingleSecondSpace, singleSecondSpace, formData.cantidadParticipantes, availableSpaces]);

  const patternDatesValidation = useMemo(() => {
    if (bookingMode !== 'pattern' || !generateFullSeries) return { isValid: true, error: undefined };
    if (!recurrenceStartDate || !recurrenceEndDate) {
      return { isValid: false, error: 'Debe ingresar las fechas de inicio y término de la serie.' };
    }
    if (recurrenceEndDate < recurrenceStartDate) {
      return { isValid: false, error: 'La fecha de término de la serie no puede ser anterior a la fecha de inicio.' };
    }
    if (selectedDays.length === 0) {
      return { isValid: false, error: 'Debes seleccionar al menos un día de la semana.' };
    }
    if (generatedDates.length === 0) {
      return { isValid: false, error: 'El rango y días seleccionados no generan ninguna sesión válida (0 sesiones calculadas).' };
    }
    return { isValid: true, error: undefined };
  }, [bookingMode, generateFullSeries, recurrenceStartDate, recurrenceEndDate, selectedDays, generatedDates]);

  const specificDatesValidation = useMemo(() => {
    if (bookingMode !== 'specific' || !generateFullSeries) return { isValid: true, error: undefined };
    if (specificDates.length === 0) {
      return { isValid: false, error: 'Debes seleccionar al menos una fecha específica.' };
    }
    return { isValid: true, error: undefined };
  }, [bookingMode, generateFullSeries, specificDates]);

  const isFormSubmitDisabled = useMemo(() => {
    if (isSubmitting) return true;
    const isTimeInvalid = Boolean(
      formData.horaInicio &&
      formData.horaFin &&
      !formData.terminaDiaSiguiente &&
      (timeStringToMinutes(formData.horaFin) <= timeStringToMinutes(formData.horaInicio) || formData.horaFin <= formData.horaInicio)
    );
    if (!timeValidation.isValid || isTimeInvalid) return true;
    if (!descriptionValidation.isValid) return true;
    if (enableSingleSecondSpace && !singleSecondTimeValidation.isValid) return true;
    if (!rutValidation.isValid) return true;
    if (!emailValidation.isValid) return true;
    if (!phoneValidation.isValid) return true;
    if (loanScheduleCheck.requiresAuthorization && !isExtensionAuthorized) return true;
    if (!patternDatesValidation.isValid) return true;
    if (!specificDatesValidation.isValid) return true;
    if (!formData.responsable?.trim()) return true;
    if (!formData.tipoActividad) return true;
    if (!formData.espacio) return true;
    if (bookingMode === 'single' && !formData.fecha) return true;
    return false;
  }, [
    isSubmitting,
    timeValidation.isValid,
    descriptionValidation.isValid,
    enableSingleSecondSpace,
    singleSecondTimeValidation.isValid,
    rutValidation.isValid,
    emailValidation.isValid,
    phoneValidation.isValid,
    loanScheduleCheck.requiresAuthorization,
    isExtensionAuthorized,
    patternDatesValidation.isValid,
    specificDatesValidation.isValid,
    formData.responsable,
    formData.tipoActividad,
    formData.espacio,
    bookingMode,
    formData.fecha
  ]);

  // Excluded IDs and series for conflict detection when editing
  const excludeReservationIds = useMemo(() => {
    if (isDuplicating || !editingReservation) return [];
    const ids: string[] = [];
    if (editingReservation.id) ids.push(editingReservation.id);
    if (formData.id && formData.id !== editingReservation.id) ids.push(formData.id);

    // If editing recurring series, exclude all reservations affected in current scope
    if (isEditingRecurring) {
      if (updateScope === 'single') {
        ids.push(editingReservation.id);
      } else {
        affectedReservations.forEach((r) => ids.push(r.id));
      }
    }
    return Array.from(new Set(ids));
  }, [editingReservation, formData.id, isDuplicating, isEditingRecurring, updateScope, affectedReservations]);

  const excludeSeriesId = useMemo(() => {
    if (isDuplicating || !editingReservation) return undefined;
    if (isEditingRecurring && updateScope === 'series') {
      return editingReservation.serieRecurrente || editingReservation.recurrenteId || undefined;
    }
    return undefined;
  }, [editingReservation, isDuplicating, isEditingRecurring, updateScope]);

  // Conflict calculation for individual date slots (primary slot 1 or secondary slot 2)
  const getDateSlotConflict = (
    dateStr: string,
    customSlot?: CustomScheduleSlot,
    slotNumber: 1 | 2 = 1
  ) => {
    if (slotNumber === 2) {
      const hInicio = customSlot?.secondHoraInicio || '11:00';
      const hFin = customSlot?.secondHoraFin || '12:00';
      const esp = customSlot?.secondEspacio || availableSpaces[1]?.name || 'SALA 2';
      return checkSingleConflict(
        {
          ...formData,
          fecha: dateStr,
          horaInicio: hInicio,
          horaFin: hFin,
          espacio: esp
        },
        allReservations,
        excludeReservationIds,
        excludeSeriesId
      );
    }

    const hInicio = customSlot?.horaInicio || formData.horaInicio || '10:00';
    const hFin = customSlot?.horaFin || formData.horaFin || '11:00';
    const esp = customSlot?.espacio || formData.espacio;
    return checkSingleConflict(
      {
        ...formData,
        fecha: dateStr,
        horaInicio: hInicio,
        horaFin: hFin,
        espacio: esp
      },
      allReservations,
      excludeReservationIds,
      excludeSeriesId
    );
  };

  // Conflict check for single date 2nd space
  const singleSecondSpaceConflicts = useMemo(() => {
    if (
      bookingMode !== 'single' ||
      !enableSingleSecondSpace ||
      !formData.fecha ||
      !singleSecondSpace ||
      !singleSecondStartTime ||
      !singleSecondEndTime
    ) {
      return [];
    }
    return checkSingleConflict(
      {
        ...formData,
        espacio: singleSecondSpace,
        horaInicio: singleSecondStartTime,
        horaFin: singleSecondEndTime
      },
      allReservations,
      excludeReservationIds,
      excludeSeriesId
    );
  }, [
    bookingMode,
    enableSingleSecondSpace,
    formData,
    singleSecondSpace,
    singleSecondStartTime,
    singleSecondEndTime,
    allReservations,
    excludeReservationIds,
    excludeSeriesId
  ]);

  // Real-time conflict check memoized to avoid recalculating on every re-render and keystroke
  const conflicts = useMemo(() => {
    if (!formData.fecha || !formData.espacio || !formData.horaInicio || !formData.horaFin) return [];
    return checkSingleConflict(formData, allReservations, excludeReservationIds, excludeSeriesId);
  }, [
    formData.fecha,
    formData.horaInicio,
    formData.horaFin,
    formData.espacio,
    formData.terminaDiaSiguiente,
    allReservations,
    excludeReservationIds,
    excludeSeriesId
  ]);

  // Quick resolution options for the main conflict
  const mainDuration = useMemo(() => {
    const sMin = timeToMinutes(formData.horaInicio || '10:00');
    const eMin = timeToMinutes(formData.horaFin || '11:00');
    if (formData.terminaDiaSiguiente || (eMin <= sMin && eMin > 0)) {
      return (24 * 60 - sMin) + eMin;
    }
    return eMin > sMin ? eMin - sMin : 60;
  }, [formData.horaInicio, formData.horaFin, formData.terminaDiaSiguiente]);

  const quickFreeSlots = useMemo(() => {
    if (!formData.fecha || !formData.espacio || conflicts.length === 0) return [];
    return findAvailableTimeSlotsInSpace(
      formData.fecha,
      formData.espacio,
      mainDuration,
      allReservations,
      timeToMinutes(formData.horaInicio || '10:00'),
      excludeReservationIds,
      { maxSameSpaceSlots: 3, customSpacesList: availableSpaces },
      excludeSeriesId
    );
  }, [formData.fecha, formData.espacio, formData.horaInicio, mainDuration, conflicts.length, allReservations, excludeReservationIds, availableSpaces, excludeSeriesId]);

  const quickAltSpaces = useMemo(() => {
    if (!formData.fecha || !formData.espacio || conflicts.length === 0) return [];
    const sMin = timeToMinutes(formData.horaInicio || '10:00');
    const eMin = timeToMinutes(formData.horaFin || '11:00');
    return findAlternativeFreeSpaces(
      formData.fecha,
      sMin,
      eMin,
      formData.espacio,
      allReservations,
      formData.cantidadParticipantes,
      excludeReservationIds,
      { maxOtherSpaces: 3, customSpacesList: availableSpaces },
      excludeSeriesId
    );
  }, [formData.fecha, formData.espacio, formData.horaInicio, formData.horaFin, formData.cantidadParticipantes, conflicts.length, allReservations, excludeReservationIds, availableSpaces, excludeSeriesId]);

  // Direct 1-click move immediately after a specific conflicting booking
  const handleShiftImmediatelyAfter = (conflictEndStr: string) => {
    const startMin = timeToMinutes(conflictEndStr);
    const endMin = startMin + mainDuration;
    if (endMin > 1380) {
      showFormFeedback('El horario resultante excede el horario operativo (23:00).', 'warning');
      return;
    }
    setFormData(prev => ({
      ...prev,
      horaInicio: formatMinutesToTime(startMin),
      horaFin: formatMinutesToTime(endMin)
    }));
  };

  // Quick-solve for single day 2nd space
  const handleFindNextSlotForSecondSpace = () => {
    if (!formData.fecha || !singleSecondSpace) return;
    const sMin = timeToMinutes(singleSecondStartTime || '11:00');
    const eMin = timeToMinutes(singleSecondEndTime || '12:00');
    const dur = eMin > sMin ? eMin - sMin : 60;
    const slots = findAvailableTimeSlotsInSpace(
      formData.fecha,
      singleSecondSpace,
      dur,
      allReservations,
      sMin,
      excludeReservationIds,
      { maxSameSpaceSlots: 1, customSpacesList: availableSpaces },
      excludeSeriesId
    );
    if (slots.length > 0) {
      setSingleSecondStartTime(slots[0].horaInicio);
      setSingleSecondEndTime(slots[0].horaFin);
    } else {
      showFormFeedback(`No se encontró bloque libre en ${singleSecondSpace} para el día ${formatDateDDMMYYYY(formData.fecha)}.`, 'warning');
    }
  };

  const handleSwitchSecondSpaceToAvailable = () => {
    if (!formData.fecha) return;
    const sMin = timeToMinutes(singleSecondStartTime || '11:00');
    const eMin = timeToMinutes(singleSecondEndTime || '12:00');
    const freeRooms = findAlternativeFreeSpaces(
      formData.fecha,
      sMin,
      eMin,
      singleSecondSpace,
      allReservations,
      formData.cantidadParticipantes,
      excludeReservationIds,
      { maxOtherSpaces: 1, customSpacesList: availableSpaces },
      excludeSeriesId
    );
    if (freeRooms.length > 0) {
      setSingleSecondSpace(freeRooms[0].espacio);
    } else {
      showFormFeedback('No hay otros recintos libres en ese horario.', 'warning');
    }
  };

  // Auto-fix for specific date schedules
  const handleAutoFixDateSchedule = (d: string, slotNum: 1 | 2 = 1) => {
    const currentSlot = dateSchedules[d] || {
      horaInicio: formData.horaInicio || '10:00',
      horaFin: formData.horaFin || '11:00',
      espacio: formData.espacio
    };
    const targetSpace = slotNum === 1 ? (currentSlot.espacio || formData.espacio || 'GIMNASIO') : (currentSlot.secondEspacio || availableSpaces[1]?.name || 'SALA 2');
    const startMin = timeToMinutes(slotNum === 1 ? (currentSlot.horaInicio || '10:00') : (currentSlot.secondHoraInicio || '11:00'));
    const endMin持 = timeToMinutes(slotNum === 1 ? (currentSlot.horaFin || '11:00') : (currentSlot.secondHoraFin || '12:00'));
    const dur = endMin持 - startMin > 0 ? endMin持 - startMin : 60;

    const slots = findAvailableTimeSlotsInSpace(
      d,
      targetSpace,
      dur,
      allReservations,
      startMin,
      excludeReservationIds,
      { maxSameSpaceSlots: 1, customSpacesList: availableSpaces },
      excludeSeriesId
    );

    if (slots.length > 0) {
      if (slotNum === 1) {
        setDateSchedules(prev => ({
          ...prev,
          [d]: {
            ...(prev[d] || currentSlot),
            horaInicio: slots[0].horaInicio,
            horaFin: slots[0].horaFin
          }
        }));
      } else {
        setDateSchedules(prev => ({
          ...prev,
          [d]: {
            ...(prev[d] || currentSlot),
            secondHoraInicio: slots[0].horaInicio,
            secondHoraFin: slots[0].horaFin
          }
        }));
      }
    } else {
      const altSpaces = findAlternativeFreeSpaces(
        d,
        startMin,
        endMin持,
        targetSpace,
        allReservations,
        formData.cantidadParticipantes,
        excludeReservationIds,
        { maxOtherSpaces: 1, customSpacesList: availableSpaces },
        excludeSeriesId
      );
      if (altSpaces.length > 0) {
        if (slotNum === 1) {
          setDateSchedules(prev => ({
            ...prev,
            [d]: {
              ...(prev[d] || currentSlot),
              espacio: altSpaces[0].espacio
            }
          }));
        } else {
          setDateSchedules(prev => ({
            ...prev,
            [d]: {
              ...(prev[d] || currentSlot),
              secondEspacio: altSpaces[0].espacio
            }
          }));
        }
      } else {
        showFormFeedback(`No se encontró horario ni sala libre para la fecha ${formatDateDDMMYYYY(d)}.`, 'warning');
      }
    }
  };

  const handleAutoFixAllDatesWithConflicts = () => {
    let fixedCount = 0;
    setDateSchedules(prev => {
      const updated = { ...prev };
      for (const d of specificDates) {
        const slot = updated[d] || {
          horaInicio: formData.horaInicio || '10:00',
          horaFin: formData.horaFin || '11:00',
          espacio: formData.espacio,
          hasSecondSlot: false
        };
        const s1Conflicts = getDateSlotConflict(d, slot, 1);
        if (s1Conflicts.length > 0) {
          const sMin = timeToMinutes(slot.horaInicio || '10:00');
          const eMin = timeToMinutes(slot.horaFin || '11:00');
          const dur = eMin - sMin > 0 ? eMin - sMin : 60;
          const freeSlots = findAvailableTimeSlotsInSpace(d, slot.espacio || formData.espacio || 'GIMNASIO', dur, allReservations, sMin, excludeReservationIds, { maxSameSpaceSlots: 1, customSpacesList: availableSpaces }, excludeSeriesId);
          if (freeSlots.length > 0) {
            updated[d] = {
              ...(updated[d] || slot),
              horaInicio: freeSlots[0].horaInicio,
              horaFin: freeSlots[0].horaFin
            };
            fixedCount++;
          } else {
            const altSpaces = findAlternativeFreeSpaces(d, sMin, eMin, slot.espacio || formData.espacio || 'GIMNASIO', allReservations, formData.cantidadParticipantes, excludeReservationIds, { maxOtherSpaces: 1, customSpacesList: availableSpaces }, excludeSeriesId);
            if (altSpaces.length > 0) {
              updated[d] = {
                ...(updated[d] || slot),
                espacio: altSpaces[0].espacio
              };
              fixedCount++;
            }
          }
        }
        if (slot.hasSecondSlot && slot.secondEspacio) {
          const s2Conflicts = getDateSlotConflict(d, slot, 2);
          if (s2Conflicts.length > 0) {
            const sMin2 = timeToMinutes(slot.secondHoraInicio || '11:00');
            const eMin2 = timeToMinutes(slot.secondHoraFin || '12:00');
            const dur2 = eMin2 - sMin2 > 0 ? eMin2 - sMin2 : 60;
            const freeSlots2 = findAvailableTimeSlotsInSpace(d, slot.secondEspacio, dur2, allReservations, sMin2, excludeReservationIds, { maxSameSpaceSlots: 1, customSpacesList: availableSpaces }, excludeSeriesId);
            if (freeSlots2.length > 0) {
              updated[d] = {
                ...(updated[d] || slot),
                secondHoraInicio: freeSlots2[0].horaInicio,
                secondHoraFin: freeSlots2[0].horaFin
              };
              fixedCount++;
            }
          }
        }
      }
      return updated;
    });
    if (fixedCount > 0) {
      showFormFeedback(`¡Se auto-ajustaron ${fixedCount} horario(s) o espacio(s) con topamiento!`, 'success');
    } else {
      showFormFeedback('No se detectaron cambios pendientes o no hay bloques libres disponibles.', 'info');
    }
  };

  // Helper to suggest next available time slot in the same space on that day
  const handleFindNextAvailableSlot = () => {
    if (!formData.fecha || !formData.espacio) return;

    const duration =
      timeToMinutes(formData.horaFin || '11:00') - timeToMinutes(formData.horaInicio || '10:00');

    // Get all bookings on that day in this space
    const dayBookings = allReservations
      .filter(
        (r) =>
          !excludeReservationIds.includes(r.id) &&
          (!excludeSeriesId || (r.serieRecurrente !== excludeSeriesId && r.recurrenteId !== excludeSeriesId)) &&
          r.fecha === formData.fecha &&
          r.espacio.toUpperCase() === formData.espacio!.toUpperCase()
      )
      .map((r) => ({
        start: timeToMinutes(r.horaInicio),
        end: timeToMinutes(r.horaFin)
      }))
      .sort((a, b) => a.start - b.start);

    // Search between 08:30 (or 06:00 if extended) and 22:00 (or 24:00 if extended)
    const searchMin = isExtensionAuthorized ? 360 : 480;
    const searchMax = isExtensionAuthorized ? 1440 : 1320;
    let foundSlot: { start: number; end: number } | null = null;
    for (let t = searchMin; t + duration <= searchMax; t += 30) {
      const slotEnd = t + duration;
      const overlaps = dayBookings.some((b) => t < b.end && b.start < slotEnd);
      if (!overlaps) {
        foundSlot = { start: t, end: slotEnd };
        break;
      }
    }

    if (foundSlot) {
      setFormData((prev) => ({
        ...prev,
        horaInicio: formatMinutesToTime(foundSlot!.start),
        horaFin: formatMinutesToTime(foundSlot!.end)
      }));
    } else {
      showFormFeedback(`No se encontró un bloque libre de ${duration} minutos en ${formData.espacio} para la fecha ${formatDateDDMMYYYY(formData.fecha)}. Prueba en otro espacio o fecha.`, 'warning');
    }
  };

  // Apply recommendation handler from the smart recommender system
  const handleApplyRecommendation = (rec: ConflictRecommendation) => {
    setFormData((prev) => ({
      ...prev,
      fecha: rec.fecha || prev.fecha,
      horaInicio: rec.horaInicio,
      horaFin: rec.horaFin,
      espacio: rec.espacio
    }));
  };

  // Comprehensive candidate conflict dates check across all booking modes
  const candidateConflictDates = useMemo(() => {
    const datesWithConflicts: string[] = [];

    if (editingReservation && !isDuplicating && isEditingRecurring) {
      if (updateScope === 'single') {
        const d = formData.fecha || editingReservation.fecha;
        if (d && formData.espacio && formData.horaInicio && formData.horaFin) {
          const s1 = checkSingleConflict(
            { ...formData, fecha: d, horaInicio: formData.horaInicio, horaFin: formData.horaFin, espacio: formData.espacio },
            allReservations,
            excludeReservationIds,
            excludeSeriesId
          );
          if (s1.length > 0) datesWithConflicts.push(d);
        }
      } else {
        affectedReservations.forEach((r) => {
          const s1 = checkSingleConflict(
            {
              ...formData,
              fecha: r.fecha,
              horaInicio: formData.horaInicio || r.horaInicio,
              horaFin: formData.horaFin || r.horaFin,
              espacio: formData.espacio || r.espacio
            },
            allReservations,
            excludeReservationIds,
            excludeSeriesId
          );
          if (s1.length > 0) datesWithConflicts.push(r.fecha);
        });
      }
      return Array.from(new Set(datesWithConflicts));
    }

    if (bookingMode === 'single' || isEditingSingleOccurrence) {
      const d = formData.fecha || editingReservation?.fecha;
      if (d && formData.espacio && formData.horaInicio && formData.horaFin) {
        const s1 = checkSingleConflict(
          { ...formData, fecha: d, horaInicio: formData.horaInicio, horaFin: formData.horaFin, espacio: formData.espacio },
          allReservations,
          excludeReservationIds,
          excludeSeriesId
        );
        const s2 = (enableSingleSecondSpace && singleSecondSpace && singleSecondStartTime && singleSecondEndTime)
          ? checkSingleConflict(
              { ...formData, fecha: d, horaInicio: singleSecondStartTime, horaFin: singleSecondEndTime, espacio: singleSecondSpace },
              allReservations,
              excludeReservationIds,
              excludeSeriesId
            )
          : [];
        if (s1.length > 0 || s2.length > 0) {
          datesWithConflicts.push(d);
        }
      }
    } else if (bookingMode === 'specific') {
      specificDates.forEach((d) => {
        const customSlot = useCustomSchedulesPerDate ? dateSchedules[d] : undefined;
        const hInicio = customSlot?.horaInicio || formData.horaInicio || '10:00';
        const hFin = customSlot?.horaFin || formData.horaFin || '11:00';
        const esp = customSlot?.espacio || formData.espacio || availableSpaces[0]?.name;
        const s1 = (esp && hInicio && hFin)
          ? checkSingleConflict(
              { ...formData, fecha: d, horaInicio: hInicio, horaFin: hFin, espacio: esp },
              allReservations,
              excludeReservationIds,
              excludeSeriesId
            )
          : [];

        const hasSecond = useCustomSchedulesPerDate ? customSlot?.hasSecondSlot : enableSingleSecondSpace;
        const s2Esp = useCustomSchedulesPerDate ? customSlot?.secondEspacio : singleSecondSpace;
        const s2Start = useCustomSchedulesPerDate ? customSlot?.secondHoraInicio : singleSecondStartTime;
        const s2End = useCustomSchedulesPerDate ? customSlot?.secondHoraFin : singleSecondEndTime;
        const s2 = (hasSecond && s2Esp && s2Start && s2End)
          ? checkSingleConflict(
              { ...formData, fecha: d, horaInicio: s2Start, horaFin: s2End, espacio: s2Esp },
              allReservations,
              excludeReservationIds,
              excludeSeriesId
            )
          : [];

        if (s1.length > 0 || s2.length > 0) {
          datesWithConflicts.push(d);
        }
      });
    } else if (bookingMode === 'pattern') {
      generatedDates.forEach((d) => {
        const dayNum = getDayOfWeekFromDateString(d);
        const customSlot = useCustomSchedulesPerDay ? daySchedules[dayNum] : undefined;
        const hInicio = customSlot?.horaInicio || formData.horaInicio || '10:00';
        const hFin = customSlot?.horaFin || formData.horaFin || '11:00';
        const esp = customSlot?.espacio || formData.espacio || availableSpaces[0]?.name;
        const s1 = (esp && hInicio && hFin)
          ? checkSingleConflict(
              { ...formData, fecha: d, horaInicio: hInicio, horaFin: hFin, espacio: esp },
              allReservations,
              excludeReservationIds,
              excludeSeriesId
            )
          : [];

        const hasSecond = useCustomSchedulesPerDay ? customSlot?.hasSecondSlot : enableSingleSecondSpace;
        const s2Esp = useCustomSchedulesPerDay ? customSlot?.secondEspacio : singleSecondSpace;
        const s2Start = useCustomSchedulesPerDay ? customSlot?.secondHoraInicio : singleSecondStartTime;
        const s2End = useCustomSchedulesPerDay ? customSlot?.secondHoraFin : singleSecondEndTime;
        const s2 = (hasSecond && s2Esp && s2Start && s2End)
          ? checkSingleConflict(
              { ...formData, fecha: d, horaInicio: s2Start, horaFin: s2End, espacio: s2Esp },
              allReservations,
              excludeReservationIds,
              excludeSeriesId
            )
          : [];

        if (s1.length > 0 || s2.length > 0) {
          datesWithConflicts.push(d);
        }
      });
    }

    return datesWithConflicts;
  }, [
    bookingMode,
    isEditingSingleOccurrence,
    editingReservation?.fecha,
    formData.fecha,
    formData.horaInicio,
    formData.horaFin,
    formData.espacio,
    formData.terminaDiaSiguiente,
    enableSingleSecondSpace,
    singleSecondSpace,
    singleSecondStartTime,
    singleSecondEndTime,
    specificDates,
    useCustomSchedulesPerDate,
    dateSchedules,
    generatedDates,
    useCustomSchedulesPerDay,
    daySchedules,
    allReservations,
    availableSpaces,
    excludeReservationIds,
    excludeSeriesId
  ]);

  // Progressive Wizard Completion and Validation Logic
  const hasStep1Conflict = useMemo(() => {
    return Boolean((conflicts.length > 0 || candidateConflictDates.length > 0) && !allowConflictOverride);
  }, [conflicts.length, candidateConflictDates.length, allowConflictOverride]);

  const isStep1Completed = useMemo(() => {
    if (!formData.espacio) return false;
    const targetDate = formData.fecha || editingReservation?.fecha;
    if (!targetDate) return false;
    const isTimeInvalid = Boolean(
      formData.horaInicio &&
      formData.horaFin &&
      !formData.terminaDiaSiguiente &&
      (timeStringToMinutes(formData.horaFin) <= timeStringToMinutes(formData.horaInicio) || formData.horaFin <= formData.horaInicio)
    );
    if (!timeValidation.isValid || isTimeInvalid) return false;
    if (enableSingleSecondSpace && !singleSecondTimeValidation.isValid) return false;
    if (hasStep1Conflict) return false;
    if (loanScheduleCheck.requiresAuthorization && !isExtensionAuthorized) return false;

    // Single date mode holiday check
    if (bookingMode === 'single') {
      if (singleDateHolidayInfo && !isHolidayAuthorized) return false;
    }

    // Specific dates mode holiday check
    if (bookingMode === 'specific') {
      if (specificDates.length === 0) return false;
      if (specificHolidayAnalysis.omittedHolidays.length > 0) {
        if (includeHolidaysInSeries || isHolidayAuthorized) {
          if (!isHolidayAuthorized) return false;
        } else {
          if (specificHolidayAnalysis.validDates.length === 0) return false;
        }
      }
    }

    // Pattern mode holiday check
    if (bookingMode === 'pattern') {
      if (includeHolidaysInSeries && !isHolidayAuthorized && patternHolidayAnalysis.omittedHolidays.length > 0) return false;
      if (generatedDates.length === 0) return false;
    }

    return true;
  }, [
    formData.espacio,
    formData.fecha,
    editingReservation?.fecha,
    timeValidation.isValid,
    enableSingleSecondSpace,
    singleSecondTimeValidation.isValid,
    hasStep1Conflict,
    loanScheduleCheck.requiresAuthorization,
    isExtensionAuthorized,
    bookingMode,
    singleDateHolidayInfo,
    isHolidayAuthorized,
    specificDates.length,
    specificHolidayAnalysis.omittedHolidays.length,
    specificHolidayAnalysis.validDates.length,
    includeHolidaysInSeries,
    patternHolidayAnalysis.omittedHolidays.length,
    generatedDates.length
  ]);

  const isStep2Completed = useMemo(() => {
    return Boolean(
      formData.responsable &&
      formData.responsable.trim().length >= 2 &&
      (!formData.rut || rutValidation.isValid) &&
      (!formData.emailContacto || emailValidation.isValid) &&
      (!formData.telefonoContacto || phoneValidation.isValid)
    );
  }, [formData.responsable, formData.rut, rutValidation.isValid, formData.emailContacto, emailValidation.isValid, formData.telefonoContacto, phoneValidation.isValid]);

  const isStep3Completed = useMemo(() => {
    return Boolean(
      formData.descripcion &&
      formData.descripcion.trim().length >= 2 &&
      descriptionValidation.isValid
    );
  }, [formData.descripcion, descriptionValidation.isValid]);

  const validateStep1 = (showAlert = true): boolean => {
    const isTimeInvalid = Boolean(
      formData.horaInicio &&
      formData.horaFin &&
      !formData.terminaDiaSiguiente &&
      (timeStringToMinutes(formData.horaFin) <= timeStringToMinutes(formData.horaInicio) || formData.horaFin <= formData.horaInicio)
    );
    if (!timeValidation.isValid || isTimeInvalid) {
      if (showAlert) showFormFeedback(`⚠️ ${timeValidation.error || 'La hora de término debe ser posterior a la hora de inicio'}`, 'warning');
      return false;
    }
    if (enableSingleSecondSpace && !singleSecondTimeValidation.isValid) {
      if (showAlert) showFormFeedback(`⚠️ ${singleSecondTimeValidation.error || 'La hora de término del segundo espacio debe ser posterior a la de inicio.'}`, 'warning');
      return false;
    }

    // Holiday validation for single date mode
    if (bookingMode === 'single') {
      const targetDate = formData.fecha || editingReservation?.fecha;
      if (!targetDate) {
        if (showAlert) showFormFeedback('⚠️ Por favor indica la fecha de la reserva.', 'warning');
        return false;
      }
      if (singleDateHolidayInfo && !isHolidayAuthorized) {
        if (showAlert) {
          showFormFeedback(
            `🚫 FECHA EN DÍA FERIADO NACIONAL: El día ${formatDateDDMMYYYY(targetDate)} es feriado (${singleDateHolidayInfo.name}). Para autorizarla debes ingresar la clave especial CCD.`,
            'warning'
          );
        }
        return false;
      }
    }

    // Holiday & date validation for specific dates mode
    if (bookingMode === 'specific') {
      if (specificDates.length === 0) {
        if (showAlert) showFormFeedback('⚠️ Por favor selecciona al menos una fecha específica en el calendario.', 'warning');
        return false;
      }
      if (specificHolidayAnalysis.omittedHolidays.length > 0) {
        if (includeHolidaysInSeries || isHolidayAuthorized) {
          if (!isHolidayAuthorized) {
            if (showAlert) showFormFeedback('🚫 Para incluir reservas en días feriados de Chile, debes ingresar la clave de autorización especial "CCD" correcta.', 'warning');
            return false;
          }
        } else {
          if (specificHolidayAnalysis.validDates.length === 0) {
            if (showAlert) {
              showFormFeedback(`🚫 Todas las fechas seleccionadas son días feriados en Chile (${specificHolidayAnalysis.omittedHolidays.map(h => `${formatDateDDMMYYYY(h.date)}: ${h.holiday.name}`).join(', ')}). Los feriados están bloqueados por defecto. Para autorizarlos debes ingresar la clave especial CCD.`, 'warning');
            }
            return false;
          }
        }
      }
    }

    // Holiday & date validation for pattern mode
    if (bookingMode === 'pattern') {
      if (includeHolidaysInSeries && !isHolidayAuthorized && patternHolidayAnalysis.omittedHolidays.length > 0) {
        if (showAlert) showFormFeedback('🚫 Para incluir los días feriados en la serie semanal, debes ingresar la clave de autorización especial "CCD" correcta.', 'warning');
        return false;
      }
      if (generatedDates.length === 0) {
        if (showAlert) showFormFeedback('⚠️ El patrón semanal no genera fechas válidas en el rango seleccionado.', 'warning');
        return false;
      }
    }

    // Extended schedule authorization check
    if (loanScheduleCheck.requiresAuthorization && !isExtensionAuthorized) {
      if (showAlert) {
        showFormFeedback('⚠️ Autorización requerida: La actividad opera en horario extendido (antes de las 08:30 hrs o después de las 22:00 hrs). Ingresa la clave oficial "ccd2026" para autorizarla.', 'warning');
      }
      return false;
    }

    if (hasStep1Conflict) {
      if (showAlert) {
        showFormFeedback('⚠️ Topamiento detectado: El espacio ya está ocupado en ese horario. Puedes resolverlo con un clic (ej: "Mover después"), activar la casilla "Permitir guardar a pesar del conflicto", o cambiar de espacio antes de continuar.', 'warning');
      }
      return false;
    }
    return true;
  };

  const validateStep2 = (showAlert = true): boolean => {
    if (!formData.responsable || !formData.responsable.trim()) {
      if (showAlert) showFormFeedback('⚠️ Por favor ingresa el nombre de la persona u organización responsable solicitante.', 'warning');
      return false;
    }
    if (formData.rut && !rutValidation.isValid) {
      if (showAlert) showFormFeedback(`⚠️ RUT inválido: ${rutValidation.error || 'Verifica el RUT ingresado.'}`, 'warning');
      return false;
    }
    if (formData.emailContacto && !emailValidation.isValid) {
      if (showAlert) showFormFeedback(`⚠️ Correo electrónico inválido: ${emailValidation.error || 'Formato de correo no válido.'}`, 'warning');
      return false;
    }
    if (formData.telefonoContacto && !phoneValidation.isValid) {
      if (showAlert) showFormFeedback(`⚠️ Teléfono inválido: ${phoneValidation.error || 'Formato de teléfono no válido.'}`, 'warning');
      return false;
    }
    return true;
  };

  const scrollToModalTop = () => {
    const modalBody = document.querySelector('#reservation-modal-form-body');
    if (modalBody) {
      modalBody.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const effectiveSeriesSlotsForLetter = useMemo(() => {
    if (bookingMode === 'specific' && generateFullSeries && specificDates.length > 0) {
      return specificDates.map((d) => {
        const custom = useCustomSchedulesPerDate ? dateSchedules[d] : undefined;
        return {
          fecha: d,
          horaInicio: custom?.horaInicio || formData.horaInicio || '14:00',
          horaFin: custom?.horaFin || formData.horaFin || '22:00',
          espacio: custom?.espacio || formData.espacio || 'SALA 3'
        };
      });
    }
    if (bookingMode === 'pattern' && generateFullSeries && generatedDates.length > 0) {
      return generatedDates.map((d) => {
        const dayNum = getDayOfWeekFromDateString(d);
        const customSlot = useCustomSchedulesPerDay ? daySchedules[dayNum] : undefined;
        return {
          fecha: d,
          horaInicio: customSlot?.horaInicio || formData.horaInicio || '14:00',
          horaFin: customSlot?.horaFin || formData.horaFin || '22:00',
          espacio: customSlot?.espacio || formData.espacio || 'SALA 3'
        };
      });
    }
    if (editingReservation) {
      const sId = editingReservation.serieRecurrente || editingReservation.recurrenteId;
      if (sId && allReservations && allReservations.length > 0) {
        const matches = allReservations.filter((r) => r.serieRecurrente === sId || r.recurrenteId === sId);
        if (matches.length > 0) {
          return matches.map((r) => ({
            fecha: r.fecha,
            horaInicio: r.horaInicio || '14:00',
            horaFin: r.horaFin || '22:00',
            espacio: r.espacio || 'SALA 3'
          }));
        }
      }
    }
    return undefined;
  }, [
    bookingMode,
    generateFullSeries,
    specificDates,
    generatedDates,
    useCustomSchedulesPerDate,
    dateSchedules,
    useCustomSchedulesPerDay,
    daySchedules,
    formData.horaInicio,
    formData.horaFin,
    formData.espacio,
    editingReservation,
    allReservations
  ]);

  const effectiveFormDataForLetter = useMemo(() => ({
    ...formData,
    espacio: enableSingleSecondSpace && singleSecondSpace
      ? `${formData.espacio || 'SALA 3'} / ${singleSecondSpace}`
      : formData.espacio
  }), [formData, enableSingleSecondSpace, singleSecondSpace]);

  const handleConfirmSaveFromConflictModal = (overrideAllowed: boolean, payload?: ConflictSavePayload) => {
    if (overrideAllowed) {
      setAllowConflictOverride(true);
    }
    setShowConflictDialog(false);
    executeSave(overrideAllowed || allowConflictOverride, payload);
  };

  const handleConvertToSpecificDates = (dates: string[], schedules: Record<string, CustomScheduleSlot>) => {
    setBookingMode('specific');
    setSpecificDates(dates);
    setUseCustomSchedulesPerDate(true);
    setDateSchedules(schedules);
  };

  const handleUpdateSecondSpace = (updates: { space?: string; startTime?: string; endTime?: string }) => {
    if (updates.space !== undefined) setSingleSecondSpace(updates.space);
    if (updates.startTime !== undefined) setSingleSecondStartTime(updates.startTime);
    if (updates.endTime !== undefined) setSingleSecondEndTime(updates.endTime);
  };

  const executeSave = async (forceConflictOverride: boolean = false, overridesPayload?: ConflictSavePayload) => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const abortWithFeedback = (msg: string, type: 'error' | 'warning' = 'error') => {
      showFormFeedback(msg, type);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    };

    if (isEditingExisting && !canModifyReservation) {
      abortWithFeedback('Permiso denegado: Solo usuarios con perfil Administrador o Coordinador están autorizados para modificar reservas existentes.');
      return;
    }
    // Sync state if overrides were passed directly from the conflict resolution wizard
    if (overridesPayload?.formDataUpdates) {
      setFormData((prev) => ({ ...prev, ...overridesPayload.formDataUpdates }));
    }
    if (overridesPayload?.specificDates) {
      setSpecificDates(overridesPayload.specificDates);
    }
    if (overridesPayload?.dateSchedules) {
      setDateSchedules(overridesPayload.dateSchedules);
    }
    if (overridesPayload?.bookingMode) {
      setBookingMode(overridesPayload.bookingMode);
    }
    if (overridesPayload?.useCustomSchedulesPerDate !== undefined) {
      setUseCustomSchedulesPerDate(overridesPayload.useCustomSchedulesPerDate);
    }
    if (overridesPayload?.secondSpaceUpdates) {
      if (overridesPayload.secondSpaceUpdates.space !== undefined) setSingleSecondSpace(overridesPayload.secondSpaceUpdates.space);
      if (overridesPayload.secondSpaceUpdates.startTime !== undefined) setSingleSecondStartTime(overridesPayload.secondSpaceUpdates.startTime);
      if (overridesPayload.secondSpaceUpdates.endTime !== undefined) setSingleSecondEndTime(overridesPayload.secondSpaceUpdates.endTime);
    }

    const effectiveFormData: Partial<Reservation> = {
      ...formData,
      ...(overridesPayload?.formDataUpdates || {})
    };
    const effectiveBookingMode = overridesPayload?.bookingMode || bookingMode;
    const effectiveSpecificDates: string[] = overridesPayload?.specificDates
      ? [...overridesPayload.specificDates]
      : [...specificDates];
    const effectiveDateSchedules: Record<string, CustomScheduleSlot> = overridesPayload?.dateSchedules
      ? { ...overridesPayload.dateSchedules }
      : { ...dateSchedules };
    const effectiveUseCustomSchedulesPerDate = overridesPayload?.useCustomSchedulesPerDate ?? useCustomSchedulesPerDate;
    const effectiveSecondSpace = overridesPayload?.secondSpaceUpdates?.space ?? singleSecondSpace;
    const effectiveSecondStartTime = overridesPayload?.secondSpaceUpdates?.startTime ?? singleSecondStartTime;
    const effectiveSecondEndTime = overridesPayload?.secondSpaceUpdates?.endTime ?? singleSecondEndTime;

    if (!effectiveFormData.responsable?.trim()) {
      abortWithFeedback('Por favor completa el nombre del responsable de la actividad.');
      return;
    }

    if (!effectiveFormData.tipoActividad) {
      abortWithFeedback('Por favor selecciona el tipo de actividad.');
      return;
    }

    const isSpecific = !isEditingSingleOccurrence && effectiveBookingMode === 'specific';
    const isPattern = !isEditingSingleOccurrence && effectiveBookingMode === 'pattern';
    const isRecurring = !isEditingSingleOccurrence && (isSpecific || isPattern);

    // Initial slot fallback if specific dates with custom schedules
    const firstSpecDate = effectiveSpecificDates[0];
    const initialSlot = (isSpecific && effectiveUseCustomSchedulesPerDate && firstSpecDate && effectiveDateSchedules[firstSpecDate])
      ? effectiveDateSchedules[firstSpecDate]
      : undefined;

    const baseStart = initialSlot?.horaInicio || effectiveFormData.horaInicio;
    const baseEnd = initialSlot?.horaFin || effectiveFormData.horaFin;
    const baseSpace = initialSlot?.espacio || effectiveFormData.espacio;

    if (!baseStart || !baseEnd || !baseSpace) {
      abortWithFeedback('Por favor completa horarios y espacio.');
      return;
    }

    if (!descriptionValidation.isValid) {
      abortWithFeedback(`⚠️ Nombre de la Actividad: ${descriptionValidation.error || 'Por favor ingresa un nombre válido.'}`);
      return;
    }

    const isTimeInvalid = Boolean(
      formData.horaInicio &&
      formData.horaFin &&
      !formData.terminaDiaSiguiente &&
      (timeStringToMinutes(formData.horaFin) <= timeStringToMinutes(formData.horaInicio) || formData.horaFin <= formData.horaInicio)
    );
    if (!timeValidation.isValid || isTimeInvalid) {
      abortWithFeedback(`⚠️ Error en horario: ${timeValidation.error || 'La hora de término debe ser posterior a la hora de inicio'}`);
      return;
    }

    if (enableSingleSecondSpace && !singleSecondTimeValidation.isValid) {
      abortWithFeedback(`⚠️ Error en horario del 2° espacio: ${singleSecondTimeValidation.error || 'La hora de término del 2° espacio debe ser posterior a la de inicio.'}`);
      return;
    }

    if (!rutValidation.isValid) {
      abortWithFeedback(`⚠️ R.U.T. inválido: ${rutValidation.error}`);
      return;
    }

    if (!emailValidation.isValid) {
      abortWithFeedback(`⚠️ Correo electrónico inválido: ${emailValidation.error}`);
      return;
    }

    if (!phoneValidation.isValid) {
      abortWithFeedback(`⚠️ Teléfono de contacto inválido: ${phoneValidation.error}`);
      return;
    }

    // Comprehensive Zod schema validation
    const candidatePayload = {
      ...formData,
      id: formData.id || editingReservation?.id || 'temp-id',
      fecha: formData.fecha || editingReservation?.fecha || '2026-01-01',
      horaInicio: baseStart,
      horaFin: baseEnd,
      espacio: baseSpace,
      responsable: formData.responsable || '',
      tipoActividad: formData.tipoActividad || 'Comunitario',
      descripcion: formData.descripcion || 'Actividad'
    };
    const zodValidation = validateReservationWithZod(candidatePayload);
    if (!zodValidation.success && zodValidation.firstError) {
      abortWithFeedback(`⚠️ ${zodValidation.firstError}`);
      return;
    }

    if (loanScheduleCheck.requiresAuthorization) {
      if (!isExtensionAuthorized) {
        abortWithFeedback('⚠️ Autorización requerida: La actividad opera en horario extendido (antes de las 08:30 hrs o después de las 22:00 hrs). Ingresa la clave oficial "ccd2026" para autorizarla.');
        return;
      }
    }

    let finalDates: string[] = [];
    if (isSpecific) {
      if (effectiveSpecificDates.length === 0) {
        abortWithFeedback('Por favor selecciona al menos una fecha específica.');
        return;
      }

      // Check holidays in specific dates
      if (specificHolidayAnalysis.omittedHolidays.length > 0) {
        if (includeHolidaysInSeries || isHolidayAuthorized) {
          if (!isHolidayAuthorized) {
            abortWithFeedback('🚫 Para incluir reservas en días feriados de Chile, debes ingresar la clave de autorización especial "CCD" correcta.');
            return;
          }
          finalDates = effectiveSpecificDates;
        } else {
          if (specificHolidayAnalysis.validDates.length === 0) {
            abortWithFeedback(`🚫 Todas las fechas seleccionadas son días feriados en Chile (${specificHolidayAnalysis.omittedHolidays.map(h => `${formatDateDDMMYYYY(h.date)}: ${h.holiday.name}`).join(', ')}).\n\nLos feriados están bloqueados por defecto. Para autorizarlos debes ingresar la clave especial CCD.`);
            return;
          }
          finalDates = [...specificHolidayAnalysis.validDates];
        }
      } else {
        finalDates = effectiveSpecificDates;
      }
    } else if (isPattern) {
      if (includeHolidaysInSeries && !isHolidayAuthorized && patternHolidayAnalysis.omittedHolidays.length > 0) {
        abortWithFeedback('🚫 Para incluir los días feriados en la serie semanal, debes ingresar la clave de autorización especial "CCD" correcta.');
        return;
      }

      if (generatedDates.length === 0) {
        if (recurrenceEndDate < recurrenceStartDate) {
          abortWithFeedback('🚫 Error: La Fecha Término de la serie no puede ser anterior a la Fecha Inicio.');
        } else if (rawPatternDates.length > 0 && patternHolidayAnalysis.omittedHolidays.length === rawPatternDates.length) {
          abortWithFeedback('🚫 Todas las fechas coincidentes con el patrón son feriados en Chile y fueron omitidas. Para autorizarlas debes ingresar la clave especial CCD.');
        } else {
          abortWithFeedback('🚫 No hay sesiones válidas coincidentes con el patrón de días y rango seleccionado (0 sesiones calculadas).');
        }
        return;
      }
      finalDates = [...generatedDates];
    } else {
      const targetSingleDate = effectiveFormData.fecha || editingReservation?.fecha;

      if (!targetSingleDate) {
        abortWithFeedback('Por favor indica la fecha de la reserva.');
        return;
      }

      // Check single date holiday
      if (singleDateHolidayInfo && !isHolidayAuthorized) {
        abortWithFeedback(
          `🚫 FECHA EN DÍA FERIADO NACIONAL: El día ${formatDateDDMMYYYY(targetSingleDate)} es feriado (${singleDateHolidayInfo.name}). Para autorizarla debes ingresar la clave CCD.`
        );
        return;
      }

      finalDates = [targetSingleDate];
    }

    // Check custom schedules timing validation
    if (isSpecific && effectiveUseCustomSchedulesPerDate && finalDates.length > 1) {
      for (const d of finalDates) {
        const slot = effectiveDateSchedules[d] || { horaInicio: effectiveFormData.horaInicio, horaFin: effectiveFormData.horaFin };
        const sMin = timeToMinutes(slot.horaInicio || '10:00');
        const eMin = timeToMinutes(slot.horaFin || '11:00');
        if (eMin <= sMin) {
          abortWithFeedback(`En la fecha ${formatDateDDMMYYYY(d)}, la hora de término (${slot.horaFin}) del 1er espacio debe ser posterior a la hora de inicio (${slot.horaInicio}).`);
          return;
        }
        if (slot.hasSecondSlot) {
          const sMin2 = timeToMinutes(slot.secondHoraInicio || '11:00');
          const eMin2 = timeToMinutes(slot.secondHoraFin || '12:00');
          if (eMin2 <= sMin2) {
            abortWithFeedback(`En la fecha ${formatDateDDMMYYYY(d)}, la hora de término (${slot.secondHoraFin}) del 2do espacio (${slot.secondEspacio}) debe ser posterior a la hora de inicio (${slot.secondHoraInicio}).`);
            return;
          }
        }
      }
    }

    if (isPattern && useCustomSchedulesPerDay) {
      for (const dayNum of selectedDays) {
        const slot = daySchedules[dayNum] || { horaInicio: effectiveFormData.horaInicio, horaFin: effectiveFormData.horaFin };
        const sMin = timeToMinutes(slot.horaInicio || '10:00');
        const eMin = timeToMinutes(slot.horaFin || '11:00');
        const dayObj = WEEKDAYS.find(w => w.dayNum === dayNum);
        if (eMin <= sMin) {
          abortWithFeedback(`Para el día ${dayObj?.full || 'seleccionado'}, la hora de término (${slot.horaFin}) del 1er espacio debe ser posterior a la hora de inicio (${slot.horaInicio}).`);
          return;
        }
        if (slot.hasSecondSlot) {
          const sMin2 = timeToMinutes(slot.secondHoraInicio || '11:00');
          const eMin2 = timeToMinutes(slot.secondHoraFin || '12:00');
          if (eMin2 <= sMin2) {
            abortWithFeedback(`Para el día ${dayObj?.full || 'seleccionado'}, la hora de término (${slot.secondHoraFin}) del 2do espacio (${slot.secondEspacio}) debe ser posterior a la hora de inicio (${slot.secondHoraInicio}).`);
            return;
          }
        }
      }
    }

    // Validation for single day 2nd space
    if (!isRecurring && enableSingleSecondSpace) {
      if (!effectiveSecondSpace) {
        abortWithFeedback('Por favor selecciona el segundo espacio para registrar.');
        return;
      }
      const sMin2 = timeToMinutes(effectiveSecondStartTime || '11:00');
      const eMin2 = timeToMinutes(effectiveSecondEndTime || '12:00');
      if (eMin2 <= sMin2) {
        abortWithFeedback(`Para el 2do espacio (${effectiveSecondSpace}), la hora de término (${effectiveSecondEndTime}) debe ser posterior a la hora de inicio (${effectiveSecondStartTime}).`);
        return;
      }
    }

    // Check if any requested date/time overlaps with a Maintenance Block
    if (spaceBlocks && spaceBlocks.length > 0) {
      for (const d of finalDates) {
        let hStart = effectiveFormData.horaInicio || '10:00';
        let hEnd = effectiveFormData.horaFin || '11:00';
        let esp = effectiveFormData.espacio || availableSpaces[0]?.name || '';

        if (isPattern && useCustomSchedulesPerDay) {
          const dayNum = getDayOfWeekFromDateString(d);
          const sched = daySchedules[dayNum];
          if (sched) {
            hStart = sched.horaInicio || hStart;
            hEnd = sched.horaFin || hEnd;
            esp = sched.espacio || esp;
          }
        } else if (isSpecific && effectiveUseCustomSchedulesPerDate) {
          const customSlot = effectiveDateSchedules[d];
          if (customSlot) {
            hStart = customSlot.horaInicio || hStart;
            hEnd = customSlot.horaFin || hEnd;
            esp = customSlot.espacio || esp;
          }
        }

        const blockConflict = checkSpaceBlocked(esp, d, hStart, hEnd, [...spaceBlocks]);
        if (blockConflict) {
          abortWithFeedback(
            `El espacio '${esp}' se encuentra BLOQUEADO por mantención/obras el ${formatDateDDMMYYYY(d)} (${blockConflict.motivo}). No es posible agendar en este horario.`
          );
          return;
        }

        // Check 2nd space if active
        const hasSecond = (isPattern && useCustomSchedulesPerDay)
          ? Boolean(daySchedules[getDayOfWeekFromDateString(d)]?.hasSecondSlot)
          : (isSpecific && effectiveUseCustomSchedulesPerDate)
          ? Boolean(effectiveDateSchedules[d]?.hasSecondSlot)
          : enableSingleSecondSpace;

        if (hasSecond && effectiveSecondSpace) {
          const s2Start = effectiveSecondStartTime || '11:00';
          const s2End = effectiveSecondEndTime || '12:00';
          const blockConflict2 = checkSpaceBlocked(effectiveSecondSpace, d, s2Start, s2End, [...spaceBlocks]);
          if (blockConflict2) {
            abortWithFeedback(
              `El 2° espacio '${effectiveSecondSpace}' se encuentra BLOQUEADO por mantención/obras el ${formatDateDDMMYYYY(d)} (${blockConflict2.motivo}).`
            );
            return;
          }
        }
      }
    }

    // Topamiento check: Verification dialog to allow mass or individual resolution directly from modal
    if (!forceConflictOverride && !allowConflictOverride) {
      const remainingConflicts: string[] = [];

      if (!isRecurring) {
        const d = finalDates[0];
        const s1 = checkSingleConflict(
          { ...effectiveFormData, fecha: d, horaInicio: effectiveFormData.horaInicio, horaFin: effectiveFormData.horaFin, espacio: effectiveFormData.espacio },
          allReservations,
          excludeReservationIds,
          excludeSeriesId
        );
        const s2 = (enableSingleSecondSpace && effectiveSecondSpace && effectiveSecondStartTime && effectiveSecondEndTime)
          ? checkSingleConflict(
              { ...effectiveFormData, fecha: d, horaInicio: effectiveSecondStartTime, horaFin: effectiveSecondEndTime, espacio: effectiveSecondSpace },
              allReservations,
              excludeReservationIds,
              excludeSeriesId
            )
          : [];
        if (s1.length > 0 || s2.length > 0) {
          remainingConflicts.push(d);
        }
      } else if (isSpecific) {
        finalDates.forEach((d) => {
          const customSlot = effectiveUseCustomSchedulesPerDate ? effectiveDateSchedules[d] : undefined;
          const hInicio = customSlot?.horaInicio || effectiveFormData.horaInicio || '10:00';
          const hFin = customSlot?.horaFin || effectiveFormData.horaFin || '11:00';
          const esp = customSlot?.espacio || effectiveFormData.espacio || availableSpaces[0]?.name;
          const s1 = (esp && hInicio && hFin)
            ? checkSingleConflict(
                { ...effectiveFormData, fecha: d, horaInicio: hInicio, horaFin: hFin, espacio: esp },
                allReservations,
                excludeReservationIds,
                excludeSeriesId
              )
            : [];

          const hasSecond = effectiveUseCustomSchedulesPerDate ? customSlot?.hasSecondSlot : enableSingleSecondSpace;
          const s2Esp = effectiveUseCustomSchedulesPerDate ? customSlot?.secondEspacio : effectiveSecondSpace;
          const s2Start = effectiveUseCustomSchedulesPerDate ? customSlot?.secondHoraInicio : effectiveSecondStartTime;
          const s2End = effectiveUseCustomSchedulesPerDate ? customSlot?.secondHoraFin : effectiveSecondEndTime;
          const s2 = (hasSecond && s2Esp && s2Start && s2End)
            ? checkSingleConflict(
                { ...effectiveFormData, fecha: d, horaInicio: s2Start, horaFin: s2End, espacio: s2Esp },
                allReservations,
                excludeReservationIds,
                excludeSeriesId
              )
            : [];

          if (s1.length > 0 || s2.length > 0) {
            remainingConflicts.push(d);
          }
        });
      } else if (isPattern) {
        finalDates.forEach((d) => {
          const dayNum = getDayOfWeekFromDateString(d);
          const customSlot = useCustomSchedulesPerDay ? daySchedules[dayNum] : undefined;
          const hInicio = customSlot?.horaInicio || effectiveFormData.horaInicio || '10:00';
          const hFin = customSlot?.horaFin || effectiveFormData.horaFin || '11:00';
          const esp = customSlot?.espacio || effectiveFormData.espacio || availableSpaces[0]?.name;
          const s1 = (esp && hInicio && hFin)
            ? checkSingleConflict(
                { ...effectiveFormData, fecha: d, horaInicio: hInicio, horaFin: hFin, espacio: esp },
                allReservations,
                excludeReservationIds,
                excludeSeriesId
              )
            : [];

          const hasSecond = useCustomSchedulesPerDay ? customSlot?.hasSecondSlot : enableSingleSecondSpace;
          const s2Esp = useCustomSchedulesPerDay ? customSlot?.secondEspacio : effectiveSecondSpace;
          const s2Start = useCustomSchedulesPerDay ? customSlot?.secondHoraInicio : effectiveSecondStartTime;
          const s2End = useCustomSchedulesPerDay ? customSlot?.secondHoraFin : effectiveSecondEndTime;
          const s2 = (hasSecond && s2Esp && s2Start && s2End)
            ? checkSingleConflict(
                { ...effectiveFormData, fecha: d, horaInicio: s2Start, horaFin: s2End, espacio: s2Esp },
                allReservations,
                excludeReservationIds,
                excludeSeriesId
              )
            : [];

          if (s1.length > 0 || s2.length > 0) {
            remainingConflicts.push(d);
          }
        });
      }

      if (remainingConflicts.length > 0) {
        setShowConflictDialog(true);
        return;
      }
    }

    const normalizedSpace = normalizeSpaceName(effectiveFormData.espacio || baseSpace || 'Espacio');

    const diasSemanaStr = isPattern
      ? selectedDays
          .map((d) => WEEKDAYS.find((w) => w.dayNum === d)?.key || '')
          .filter(Boolean)
          .join(',')
      : '';

    const seriesId = `SER_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Build the explicit payload for all dates with individual space and schedule
    let finalSeriesPayload: (string | SeriesItemSlot)[] = finalDates;

    if (isSpecific && effectiveUseCustomSchedulesPerDate) {
      finalSeriesPayload = [];
      for (const d of finalDates) {
        const slot = effectiveDateSchedules[d] || {
          horaInicio: effectiveFormData.horaInicio || '10:00',
          horaFin: effectiveFormData.horaFin || '11:00',
          espacio: effectiveFormData.espacio
        };
        finalSeriesPayload.push({
          fecha: d,
          horaInicio: slot.horaInicio || effectiveFormData.horaInicio || '10:00',
          horaFin: slot.horaFin || effectiveFormData.horaFin || '11:00',
          espacio: slot.espacio ? normalizeSpaceName(slot.espacio) : normalizedSpace
        });
        if (slot.hasSecondSlot && slot.secondEspacio) {
          finalSeriesPayload.push({
            fecha: d,
            horaInicio: slot.secondHoraInicio || '11:00',
            horaFin: slot.secondHoraFin || '12:00',
            espacio: normalizeSpaceName(slot.secondEspacio)
          });
        }
      }
    } else if (isSpecific && enableSingleSecondSpace && effectiveSecondSpace) {
      finalSeriesPayload = [];
      for (const d of finalDates) {
        finalSeriesPayload.push({
          fecha: d,
          horaInicio: effectiveFormData.horaInicio || '10:00',
          horaFin: effectiveFormData.horaFin || '11:00',
          espacio: normalizedSpace
        });
        finalSeriesPayload.push({
          fecha: d,
          horaInicio: effectiveSecondStartTime || '11:00',
          horaFin: effectiveSecondEndTime || '12:00',
          espacio: normalizeSpaceName(effectiveSecondSpace)
        });
      }
    } else if (isPattern && useCustomSchedulesPerDay) {
      finalSeriesPayload = [];
      for (const d of finalDates) {
        const dayNum = getDayOfWeekFromDateString(d);
        const sched = daySchedules[dayNum];
        finalSeriesPayload.push({
          fecha: d,
          horaInicio: sched?.horaInicio || effectiveFormData.horaInicio || '10:00',
          horaFin: sched?.horaFin || effectiveFormData.horaFin || '11:00',
          espacio: sched?.espacio ? normalizeSpaceName(sched.espacio) : normalizedSpace
        });
        if (sched?.hasSecondSlot && sched?.secondEspacio) {
          finalSeriesPayload.push({
            fecha: d,
            horaInicio: sched.secondHoraInicio || '11:00',
            horaFin: sched.secondHoraFin || '12:00',
            espacio: normalizeSpaceName(sched.secondEspacio)
          });
        }
      }
    } else if (isRecurring) {
      if (enableSingleSecondSpace && effectiveSecondSpace) {
        finalSeriesPayload = [];
        for (const d of finalDates) {
          finalSeriesPayload.push({
            fecha: d,
            horaInicio: effectiveFormData.horaInicio || '10:00',
            horaFin: effectiveFormData.horaFin || '11:00',
            espacio: normalizedSpace
          });
          finalSeriesPayload.push({
            fecha: d,
            horaInicio: effectiveSecondStartTime || '11:00',
            horaFin: effectiveSecondEndTime || '12:00',
            espacio: normalizeSpaceName(effectiveSecondSpace)
          });
        }
      } else {
        finalSeriesPayload = finalDates.map((d) => ({
          fecha: d,
          horaInicio: effectiveFormData.horaInicio || '10:00',
          horaFin: effectiveFormData.horaFin || '11:00',
          espacio: normalizedSpace
        }));
      }
    } else if (enableSingleSecondSpace) {
      // Single day with 2 spaces in different schedules
      finalSeriesPayload = [
        {
          fecha: effectiveFormData.fecha || '',
          horaInicio: effectiveFormData.horaInicio || '10:00',
          horaFin: effectiveFormData.horaFin || '11:00',
          espacio: normalizedSpace
        },
        {
          fecha: effectiveFormData.fecha || '',
          horaInicio: effectiveSecondStartTime || '11:00',
          horaFin: effectiveSecondEndTime || '12:00',
          espacio: normalizeSpaceName(effectiveSecondSpace)
        }
      ];
    }

    // When editing ONLY this occurrence or a single reservation, use the updated date if moved!
    const firstDate = (isEditingSingleOccurrence && effectiveFormData.fecha)
      ? effectiveFormData.fecha
      : (finalDates.length > 0 ? finalDates[0] : (effectiveFormData.fecha || editingReservation?.fecha || ''));

    const firstSlot = (finalSeriesPayload.length > 0 && typeof finalSeriesPayload[0] !== 'string' && !isEditingSingleOccurrence)
      ? (finalSeriesPayload[0] as SeriesItemSlot)
      : {
          fecha: firstDate,
          horaInicio: effectiveFormData.horaInicio || '10:00',
          horaFin: effectiveFormData.horaFin || '11:00',
          espacio: normalizedSpace
        };

    const isSingleMultiSpace = enableSingleSecondSpace && !isRecurring && (!editingReservation || isDuplicating);
    const isMultiEntry = isRecurring && !isEditingSingleOccurrence;
    const totalSlotsGenerated = isEditingSingleOccurrence ? 1 : finalSeriesPayload.length;

    const finalReserva: Reservation = {
      id: (isEditingSingleOccurrence && editingReservation)
        ? editingReservation.id
        : (effectiveFormData.id || `RSV_${Math.random().toString(36).substring(2, 10).toUpperCase()}`),
      fecha: firstDate,
      horaInicio: firstSlot.horaInicio || effectiveFormData.horaInicio || '10:00',
      horaFin: firstSlot.horaFin || effectiveFormData.horaFin || '11:00',
      espacio: firstSlot.espacio || normalizedSpace,
      responsable: effectiveFormData.responsable || 'No especificado',
      telefonoContacto: effectiveFormData.telefonoContacto || '',
      emailContacto: effectiveFormData.emailContacto || '',
      tipoActividad: effectiveFormData.tipoActividad || 'OTROS',
      tipoPrestamo: effectiveFormData.tipoPrestamo || '',
      descripcion: effectiveFormData.descripcion || '',
      actividadRecurrente: isEditingSingleOccurrence ? (editingReservation?.actividadRecurrente || 'No') : (isMultiEntry ? 'Sí' : 'No'),
      comentarios: effectiveFormData.comentarios || '',
      serieRecurrente: isEditingSingleOccurrence
        ? (editingReservation?.serieRecurrente || editingReservation?.recurrenteId || '')
        : (isMultiEntry ? (effectiveFormData.serieRecurrente || seriesId) : undefined),
      recurrenteId: isEditingSingleOccurrence
        ? (editingReservation?.serieRecurrente || editingReservation?.recurrenteId || '')
        : (isMultiEntry ? (effectiveFormData.recurrenteId || seriesId) : undefined),
      indiceEnSerie: isEditingSingleOccurrence ? (editingReservation?.indiceEnSerie || 1) : (effectiveFormData.indiceEnSerie || 1),
      totalEnSerie: isEditingSingleOccurrence ? (editingReservation?.totalEnSerie || 1) : (isMultiEntry && generateFullSeries ? totalSlotsGenerated : (isSingleMultiSpace ? 2 : (effectiveFormData.totalEnSerie || 1))),
      tipoRecurrencia: isEditingSingleOccurrence ? (editingReservation?.tipoRecurrencia || '') : (isSpecific ? 'especificas' : isPattern ? 'semanal' : (enableSingleSecondSpace ? 'doble_espacio' : '')),
      diasSemana: isEditingSingleOccurrence ? (editingReservation?.diasSemana || '') : diasSemanaStr,
      fechaInicioRecurrencia: isEditingSingleOccurrence
        ? (editingReservation?.fechaInicioRecurrencia || editingReservation?.fecha)
        : (isRecurring && finalDates.length > 0 ? finalDates[0] : effectiveFormData.fecha),
      fechaFinRecurrencia: isEditingSingleOccurrence
        ? (editingReservation?.fechaFinRecurrencia || editingReservation?.fecha)
        : (isRecurring && finalDates.length > 0 ? finalDates[finalDates.length - 1] : effectiveFormData.fecha),
      cantidadParticipantes: Number(effectiveFormData.cantidadParticipantes) || 10,
      realizada: effectiveFormData.realizada || 'No',
      rut: effectiveFormData.rut || '',
      domicilio: effectiveFormData.domicilio || '',
      importante: effectiveFormData.importante || 'No',
      requiereCartaCompromiso: isCommitmentLetterEligible(effectiveFormData.tipoActividad, effectiveFormData.tipoPrestamo),
      descargarCartaAlCrear: isCommitmentLetterEligible(effectiveFormData.tipoActividad, effectiveFormData.tipoPrestamo) && descargarCartaAlCrear,
      cartaCompromisoDescargada: (isCommitmentLetterEligible(effectiveFormData.tipoActividad, effectiveFormData.tipoPrestamo) && descargarCartaAlCrear) ? true : (effectiveFormData.cartaCompromisoDescargada || false),
      cartaCompromisoAdjunta: effectiveFormData.cartaCompromisoAdjunta,
      equipamientoSolicitado: effectiveFormData.equipamientoSolicitado || [],
      terminaDiaSiguiente: Boolean(effectiveFormData.terminaDiaSiguiente),
      horarioExtendidoAutorizado: loanScheduleCheck.requiresAuthorization ? true : Boolean(effectiveFormData.horarioExtendidoAutorizado),
      claveAutorizacion: loanScheduleCheck.requiresAuthorization ? 'ccd2026' : (effectiveFormData.claveAutorizacion || ''),
      autorizadoPor: loanScheduleCheck.requiresAuthorization ? (currentUser?.name || currentUser?.username || 'Administrador/Coordinador') : (effectiveFormData.autorizadoPor || ''),
      version: ((editingReservation as any)?.version || 0) + 1,
      updatedAt: new Date().toISOString()
    };

    // Auto download Commitment Letter PDF asynchronously if eligible and ticked
    // (Offloaded via setTimeout so the PDF generation does not freeze the UI or delay save & modal close)
    if (isCommitmentLetterEligible(effectiveFormData.tipoActividad, effectiveFormData.tipoPrestamo) && descargarCartaAlCrear) {
      setTimeout(() => {
        try {
          downloadCommitmentLetterPdf(finalReserva, {
            allReservations,
            seriesScheduleItems: effectiveSeriesSlotsForLetter
          });
        } catch (err) {
          console.error('Error al descargar automáticamente la carta de compromiso:', err);
        }
      }, 50);
    }

    setIsSubmitting(true);
    try {
      if (editingReservation && !isDuplicating) {
        if (!isEditingRecurring || updateScope === 'single') {
          // SINGLE RESERVATION OR SINGLE OCCURRENCE
          const updatedReserva: Reservation = {
            ...editingReservation,
            ...finalReserva,
            id: editingReservation.id,
            fecha: finalReserva.fecha,
            horaInicio: finalReserva.horaInicio,
            horaFin: finalReserva.horaFin,
            espacio: finalReserva.espacio,
            tipoActividad: finalReserva.tipoActividad,
            descripcion: finalReserva.descripcion,
            responsable: finalReserva.responsable,
            telefonoContacto: finalReserva.telefonoContacto,
            emailContacto: finalReserva.emailContacto,
            tipoPrestamo: finalReserva.tipoPrestamo,
            cantidadParticipantes: finalReserva.cantidadParticipantes,
            equipamientoSolicitado: finalReserva.equipamientoSolicitado,
            importante: finalReserva.importante,
            comentarios: finalReserva.comentarios,
            rut: finalReserva.rut,
            domicilio: finalReserva.domicilio,
            requiereCartaCompromiso: finalReserva.requiereCartaCompromiso,
            cartaCompromisoDescargada: finalReserva.cartaCompromisoDescargada,
            cartaCompromisoAdjunta: finalReserva.cartaCompromisoAdjunta,
            realizada: finalReserva.realizada,
            terminaDiaSiguiente: finalReserva.terminaDiaSiguiente,
            horarioExtendidoAutorizado: finalReserva.horarioExtendidoAutorizado,
            claveAutorizacion: finalReserva.claveAutorizacion,
            autorizadoPor: finalReserva.autorizadoPor,
            // Keep series linking
            serieRecurrente: editingReservation.serieRecurrente,
            recurrenteId: editingReservation.recurrenteId,
            indiceEnSerie: editingReservation.indiceEnSerie,
            totalEnSerie: editingReservation.totalEnSerie,
            tipoRecurrencia: editingReservation.tipoRecurrencia,
            diasSemana: editingReservation.diasSemana,
            fechaInicioRecurrencia: editingReservation.fechaInicioRecurrencia,
            fechaFinRecurrencia: editingReservation.fechaFinRecurrencia,
            editadoPor: currentUser?.name || currentUser?.username || 'Usuario',
            fechaEdicion: format(new Date(), 'dd/MM/yyyy HH:mm:ss'),
            version: ((editingReservation as any)?.version || 0) + 1,
            updatedAt: new Date().toISOString()
          };

          await Promise.resolve(
            onSave(updatedReserva, false, undefined, false, {
              scope: 'single',
              updatedReservations: [updatedReserva],
              affectedIds: [updatedReserva.id],
              description: `Modificada reserva individual '${updatedReserva.tipoActividad}' de ${updatedReserva.responsable} (${formatDateDDMMYYYY(updatedReserva.fecha)})`
            })
          );
        } else {
          // MULTI-OCCURRENCE UPDATE (future, series, dateRange, selected)
          const updatedList: Reservation[] = affectedReservations.map((orig) => ({
            ...orig,
            horaInicio: effectiveFormData.horaInicio || orig.horaInicio,
            horaFin: effectiveFormData.horaFin || orig.horaFin,
            espacio: normalizedSpace || orig.espacio,
            tipoActividad: effectiveFormData.tipoActividad || orig.tipoActividad,
            descripcion: effectiveFormData.descripcion !== undefined ? effectiveFormData.descripcion : orig.descripcion,
            responsable: effectiveFormData.responsable || orig.responsable,
            telefonoContacto: effectiveFormData.telefonoContacto !== undefined ? effectiveFormData.telefonoContacto : orig.telefonoContacto,
            emailContacto: effectiveFormData.emailContacto !== undefined ? effectiveFormData.emailContacto : orig.emailContacto,
            tipoPrestamo: effectiveFormData.tipoPrestamo || orig.tipoPrestamo,
            cantidadParticipantes: Number(effectiveFormData.cantidadParticipantes) || orig.cantidadParticipantes || 10,
            equipamientoSolicitado: effectiveFormData.equipamientoSolicitado ? JSON.parse(JSON.stringify(effectiveFormData.equipamientoSolicitado)) : orig.equipamientoSolicitado,
            importante: effectiveFormData.importante || orig.importante,
            comentarios: effectiveFormData.comentarios !== undefined ? effectiveFormData.comentarios : orig.comentarios,
            rut: effectiveFormData.rut !== undefined ? effectiveFormData.rut : orig.rut,
            domicilio: effectiveFormData.domicilio !== undefined ? effectiveFormData.domicilio : orig.domicilio,
            requiereCartaCompromiso: isCommitmentLetterEligible(effectiveFormData.tipoActividad, effectiveFormData.tipoPrestamo),
            realizada: effectiveFormData.realizada || orig.realizada,
            terminaDiaSiguiente: Boolean(effectiveFormData.terminaDiaSiguiente),
            horarioExtendidoAutorizado: loanScheduleCheck.requiresAuthorization ? true : Boolean(effectiveFormData.horarioExtendidoAutorizado),
            claveAutorizacion: loanScheduleCheck.requiresAuthorization ? 'ccd2026' : (effectiveFormData.claveAutorizacion || orig.claveAutorizacion || ''),
            autorizadoPor: loanScheduleCheck.requiresAuthorization ? (currentUser?.name || currentUser?.username || 'Administrador/Coordinador') : (effectiveFormData.autorizadoPor || orig.autorizadoPor || ''),
            editadoPor: currentUser?.name || currentUser?.username || 'Usuario',
            fechaEdicion: format(new Date(), 'dd/MM/yyyy HH:mm:ss'),
            version: ((orig as any)?.version || 0) + 1,
            updatedAt: new Date().toISOString()
          }));

          const scopeLabels: Record<UpdateScope, string> = {
            single: 'Solo esta reserva',
            future: `Desde ${formatDateDDMMYYYY(editingReservation.fecha)} en adelante (${updatedList.length} reservas)`,
            series: `Toda la serie (${updatedList.length} reservas)`,
            dateRange: `Rango ${formatDateDDMMYYYY(rangeStartDate)} a ${formatDateDDMMYYYY(rangeEndDate)} (${updatedList.length} reservas)`,
            selected: `${updatedList.length} fechas seleccionadas`
          };

          const batchResult = await Promise.resolve(
            onSave(updatedList[0], true, undefined, true, {
              scope: updateScope,
              updatedReservations: updatedList,
              affectedIds: updatedList.map((r) => r.id),
              description: `Actualizadas ${updatedList.length} reservas (${scopeLabels[updateScope]}) para '${effectiveFormData.tipoActividad || 'Actividad'}' (${effectiveFormData.responsable || 'Responsable'})`
            })
          );
          if (batchResult === false) {
            return;
          }
        }
      } else if (isRecurring && generateFullSeries && finalDates.length >= 1 && (!editingReservation || isDuplicating)) {
        const seriesResult = await Promise.resolve(onSave(finalReserva, true, finalSeriesPayload, false));
        if (seriesResult === false) {
          return;
        }
      } else if (enableSingleSecondSpace && (!editingReservation || isDuplicating)) {
        const doubleResult = await Promise.resolve(onSave(finalReserva, true, finalSeriesPayload, false));
        if (doubleResult === false) {
          return;
        }
      } else {
        const singleResult = await Promise.resolve(onSave(finalReserva, false, undefined, false));
        if (singleResult === false) {
          return;
        }
      }
      clearDraft();
      onClose();
    } catch (err: any) {
      console.error('Error al guardar la reserva:', err);
      showFormFeedback(`⚠️ Error al guardar la reserva: ${err?.message || 'Ocurrió un error inesperado al persistir los datos'}. El formulario se mantendrá abierto para que no pierdas los datos ingresados.`);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isWizardMode) {
      if (wizardStep === 1) {
        if (validateStep1(true)) {
          setWizardStep(2);
          scrollToModalTop();
        }
        return;
      }
      if (wizardStep === 2) {
        if (validateStep2(true)) {
          setWizardStep(3);
          scrollToModalTop();
        }
        return;
      }
    }
    executeSave(allowConflictOverride);
  };

  const handleDeleteFromModal = () => {
    if (!editingReservation) return;

    if (onRequestDelete) {
      onClose();
      onRequestDelete(editingReservation);
      return;
    }

    if (!canModifyReservation) {
      showFormFeedback('Permiso denegado: Solo usuarios con perfil Administrador o Coordinador están autorizados para eliminar reservas directamente.');
      return;
    }

    if (onDelete) {
      if (
        editingReservation.actividadRecurrente === 'Sí' &&
        (editingReservation.recurrenteId || editingReservation.serieRecurrente)
      ) {
        setDeleteConfirmModal({
          isOpen: true,
          title: 'Eliminar Reserva Recurrente',
          message: (
            <div className="space-y-2">
              <p className="font-semibold text-slate-800">Esta reserva forma parte de una serie periódica recurrente.</p>
              <p className="text-slate-600 text-xs">
                Puedes eliminar toda la serie recurrente completa o eliminar únicamente esta fecha individual del calendario.
              </p>
            </div>
          ),
          confirmLabel: 'Eliminar Toda la Serie',
          secondaryAction: {
            label: 'Solo Esta Fecha',
            className: 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-semibold',
            onClick: () => {
              setDeleteConfirmModal((prev) => ({ ...prev, isOpen: false }));
              onDelete(editingReservation.id, false);
              onClose();
            }
          },
          onConfirm: () => {
            setDeleteConfirmModal((prev) => ({ ...prev, isOpen: false }));
            onDelete(
              editingReservation.id,
              true,
              editingReservation.serieRecurrente || editingReservation.recurrenteId
            );
            onClose();
          }
        });
      } else {
        setDeleteConfirmModal({
          isOpen: true,
          title: 'Confirmar Eliminación',
          message: '¿Estás seguro de que deseas eliminar esta reserva?',
          confirmLabel: 'Eliminar Reserva',
          onConfirm: () => {
            setDeleteConfirmModal((prev) => ({ ...prev, isOpen: false }));
            onDelete(editingReservation.id, false);
            onClose();
          }
        });
      }
    }
  };

  const handleDuplicateReservation = () => {
    if (onDuplicateReservation) {
      onDuplicateReservation(formData as Reservation);
    } else {
      setFormData((prev) => ({
        ...prev,
        id: `RSV_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        descripcion: prev.descripcion ? `${prev.descripcion} (Copia)` : `${prev.tipoActividad} (Copia)`,
        realizada: 'No',
        serieRecurrente: undefined,
        recurrenteId: undefined,
        indiceEnSerie: undefined,
        totalEnSerie: undefined,
        actividadRecurrente: 'No'
      }));
      setBookingMode('single');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-100 overflow-hidden my-6">
        {/* Header */}
        <ReservationModalHeader
          isDuplicating={isDuplicating}
          editingReservation={editingReservation}
          isWizardMode={isWizardMode}
          setIsWizardMode={setIsWizardMode}
          onClose={onClose}
        />

        {/* Form Body */}
        <form id="reservation-modal-form-body" onSubmit={handleSubmit} noValidate className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
          {/* Notification & Context Alerts */}
          <ReservationModalAlerts
            hasDraft={hasDraft}
            draftData={draftData}
            draftTimeAgo={draftTimeAgo}
            discardDraft={discardDraft}
            restoreDraft={restoreDraft}
            isEditingExisting={isEditingExisting}
            canModifyReservation={canModifyReservation}
            currentUser={currentUser}
            editingReservation={editingReservation}
            concurrencyConflict={concurrencyConflict}
            onReloadConcurrency={() => {
              if (concurrencyConflict?.currentReservation) {
                setFormData(concurrencyConflict.currentReservation);
                initialEditingSnapshot.current = {
                  id: concurrencyConflict.currentReservation.id,
                  updatedAt: concurrencyConflict.currentReservation.updatedAt,
                  version: (concurrencyConflict.currentReservation as any)?.version
                };
                setDismissedConcurrency(true);
              }
            }}
            onDismissConcurrency={() => setDismissedConcurrency(true)}
            isDuplicating={isDuplicating}
          />

          {/* Recurring Series Notice & Granular Scope Selector */}
          {editingReservation && isEditingRecurring && (
            <RecurringSeriesScopeSelector
              editingReservation={editingReservation}
              seriesReservations={seriesReservations}
              seriesCount={seriesCount}
              affectedReservations={affectedReservations}
              updateScope={updateScope}
              setUpdateScope={setUpdateScope}
              rangeStartDate={rangeStartDate}
              setRangeStartDate={setRangeStartDate}
              rangeEndDate={rangeEndDate}
              setRangeEndDate={setRangeEndDate}
              selectedOccurrenceIds={selectedOccurrenceIds}
              setSelectedOccurrenceIds={setSelectedOccurrenceIds}
            />
          )}

          {/* 3-Step Progressive Wizard Stepper */}
          {isWizardMode && (
            <div className="space-y-2">
              <WizardStepsBar
                wizardStep={wizardStep}
                isStep1Completed={isStep1Completed}
                isStep2Completed={isStep2Completed}
                isStep3Completed={isStep3Completed}
                espacio={formData.espacio}
                responsable={formData.responsable}
                descripcion={formData.descripcion}
                onSelectStep={(targetStep) => {
                  if (targetStep === 1) {
                    setWizardStep(1);
                    scrollToModalTop();
                  } else if (targetStep === 2) {
                    if (validateStep1(false)) {
                      setWizardStep(2);
                      scrollToModalTop();
                    } else {
                      validateStep1(true);
                    }
                  } else if (targetStep === 3) {
                    if (validateStep1(false) && validateStep2(false)) {
                      setWizardStep(3);
                      scrollToModalTop();
                    } else if (!validateStep1(false)) {
                      validateStep1(true);
                    } else {
                      validateStep2(true);
                    }
                  }
                }}
              />

              {hasStep1Conflict && (
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-[11px] font-medium">
                  <div className="flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Atención: Existe un topamiento de horario en el Paso 1. Resuélvelo antes de avanzar.</span>
                  </div>
                  {wizardStep !== 1 && (
                    <button
                      type="button"
                      onClick={() => { setWizardStep(1); scrollToModalTop(); }}
                      className="text-rose-700 font-bold underline hover:text-rose-900 cursor-pointer"
                    >
                      Ir al Paso 1
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 1. ¿Dónde y Cuándo? */}
          <ReservationStep1DateTime
            isWizardMode={isWizardMode}
            wizardStep={wizardStep}
            formData={formData}
            setFormData={setFormData}
            availableSpaces={availableSpaces}
            allReservations={allReservations}
            spaceBlocks={spaceBlocks}
            editingReservation={editingReservation}
            isDuplicating={isDuplicating}
            isEditingRecurring={isEditingRecurring}
            updateScope={updateScope}
            affectedReservations={affectedReservations}
            isEditingSingleOccurrence={isEditingSingleOccurrence}
            singleDateHolidayInfo={singleDateHolidayInfo}
            handlePrimaryDateChange={handlePrimaryDateChange}
            timeValidation={timeValidation}
            conflicts={conflicts}
            candidateConflictDates={candidateConflictDates}
            mainDuration={mainDuration}
            allowConflictOverride={allowConflictOverride}
            setAllowConflictOverride={setAllowConflictOverride}
            showInlineSuggestions={showInlineSuggestions}
            setShowInlineSuggestions={setShowInlineSuggestions}
            handleShiftImmediatelyAfter={handleShiftImmediatelyAfter}
            handleApplyRecommendation={handleApplyRecommendation}
            handleFindNextAvailableSlot={handleFindNextAvailableSlot}
            quickFreeSlots={quickFreeSlots}
            quickAltSpaces={quickAltSpaces}
            setShowConflictDialog={setShowConflictDialog}
            loanScheduleCheck={loanScheduleCheck}
            currentUser={currentUser}
            extendedAuthKey={extendedAuthKey}
            setExtendedAuthKey={setExtendedAuthKey}
            isExtensionAuthorized={isExtensionAuthorized}
            enableSingleSecondSpace={enableSingleSecondSpace}
            setEnableSingleSecondSpace={setEnableSingleSecondSpace}
            singleSecondSpace={singleSecondSpace}
            setSingleSecondSpace={setSingleSecondSpace}
            singleSecondStartTime={singleSecondStartTime}
            setSingleSecondStartTime={setSingleSecondStartTime}
            singleSecondEndTime={singleSecondEndTime}
            setSingleSecondEndTime={setSingleSecondEndTime}
            singleSecondTimeValidation={singleSecondTimeValidation}
            singleSecondSpaceConflicts={singleSecondSpaceConflicts}
            handleFindNextSlotForSecondSpace={handleFindNextSlotForSecondSpace}
            handleSwitchSecondSpaceToAvailable={handleSwitchSecondSpaceToAvailable}
            holidayOverrideKey={holidayOverrideKey}
            setHolidayOverrideKey={setHolidayOverrideKey}
            isHolidayAuthorized={isHolidayAuthorized}
            bookingMode={bookingMode}
            setBookingMode={setBookingMode}
            generateFullSeries={generateFullSeries}
            setGenerateFullSeries={setGenerateFullSeries}
            specificDates={specificDates}
            setSpecificDates={setSpecificDates}
            dateInputToAdd={dateInputToAdd}
            setDateInputToAdd={setDateInputToAdd}
            currentCalendarMonth={currentCalendarMonth}
            setCurrentCalendarMonth={setCurrentCalendarMonth}
            handleAddSpecificDate={handleAddSpecificDate}
            handleToggleSpecificDate={handleToggleSpecificDate}
            handleAddRelativeDays={handleAddRelativeDays}
            specificHolidayAnalysis={specificHolidayAnalysis}
            useCustomSchedulesPerDate={useCustomSchedulesPerDate}
            setUseCustomSchedulesPerDate={setUseCustomSchedulesPerDate}
            dateSchedules={dateSchedules}
            handleUpdateDateSchedule={handleUpdateDateSchedule}
            handleCopyDateScheduleToAll={handleCopyDateScheduleToAll}
            handleAutoFixDateSchedule={handleAutoFixDateSchedule}
            handleAutoFixAllDatesWithConflicts={handleAutoFixAllDatesWithConflicts}
            handleApplyBaseToAllDates={handleApplyBaseToAllDates}
            getDateSlotConflict={getDateSlotConflict}
            selectedDays={selectedDays}
            setSelectedDays={setSelectedDays}
            toggleDay={toggleDay}
            recurrenceStartDate={recurrenceStartDate}
            setRecurrenceStartDate={setRecurrenceStartDate}
            recurrenceEndDate={recurrenceEndDate}
            setRecurrenceEndDate={setRecurrenceEndDate}
            includeHolidaysInSeries={includeHolidaysInSeries}
            setIncludeHolidaysInSeries={setIncludeHolidaysInSeries}
            patternHolidayAnalysis={patternHolidayAnalysis}
            useCustomSchedulesPerDay={useCustomSchedulesPerDay}
            setUseCustomSchedulesPerDay={setUseCustomSchedulesPerDay}
            daySchedules={daySchedules}
            handleUpdateDaySchedule={handleUpdateDaySchedule}
            handleCopyDayScheduleToAll={handleCopyDayScheduleToAll}
            handleApplyBaseToAllDays={handleApplyBaseToAllDays}
            generatedDates={generatedDates}
          />

          {/* 2. ¿Quién lo solicita? */}
      <ReservationStep2Applicant
        isWizardMode={isWizardMode}
        wizardStep={wizardStep}
        formData={formData}
        setFormData={setFormData}
        handleResponsableChange={handleResponsableChange}
        uniqueResponsablesList={uniqueResponsablesList}
        autoFilledContactNotice={autoFilledContactNotice}
        phoneValidation={phoneValidation}
        rutValidation={rutValidation}
        emailValidation={emailValidation}
        primarySpaceCapacityWarning={primarySpaceCapacityWarning}
        secondSpaceCapacityWarning={secondSpaceCapacityWarning}
        singleSecondSpace={singleSecondSpace}
        responsibleHistoryAlert={responsibleHistoryAlert}
        descargarCartaAlCrear={descargarCartaAlCrear}
        setDescargarCartaAlCrear={setDescargarCartaAlCrear}
        setShowCommitmentLetterModal={setShowCommitmentLetterModal}
        editingReservation={editingReservation}
        effectiveFormDataForLetter={effectiveFormDataForLetter}
        effectiveSeriesSlotsForLetter={effectiveSeriesSlotsForLetter}
        allReservations={allReservations}
      />

      {/* 3. Detalles & Equipamiento */}
      {(!isWizardMode || wizardStep === 3) && (
        <ReservationStep3Details
          isWizardMode={isWizardMode}
          formData={formData}
          setFormData={setFormData}
          descriptionValidation={descriptionValidation}
          effectiveActivityNames={effectiveActivityNames}
          effectiveEquipment={effectiveEquipment}
          allReservations={allReservations}
          editingReservation={editingReservation}
          bookingMode={bookingMode}
          specificDates={specificDates}
        />
      )}

          {/* Non-blocking Form Feedback Banner (D4 & D9) */}
          {formFeedback && (
            <div
              id="modal-form-feedback-banner"
              className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold animate-fadeIn ${
                formFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : formFeedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : formFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-blue-50 border-blue-300 text-blue-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormFeedback(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                aria-label="Cerrar mensaje"
              >
                ✕
              </button>
            </div>
          )}

          {/* Buttons Footer */}
          <ReservationModalFooter
            editingReservation={editingReservation}
            isDuplicating={isDuplicating}
            canModifyReservation={canModifyReservation}
            handleDuplicateReservation={handleDuplicateReservation}
            handleDeleteFromModal={handleDeleteFromModal}
            hasDeleteHandler={Boolean(onDelete)}
            isAutosaving={isAutosaving}
            autosaveLastSavedAt={autosaveLastSavedAt}
            formData={formData}
            setShowCommitmentLetterModal={setShowCommitmentLetterModal}
            isWizardMode={isWizardMode}
            wizardStep={wizardStep}
            setWizardStep={setWizardStep}
            scrollToModalTop={scrollToModalTop}
            onClose={onClose}
            validateStep1={validateStep1}
            validateStep2={validateStep2}
            isFormSubmitDisabled={isFormSubmitDisabled}
            isEditingExisting={isEditingExisting}
            conflicts={conflicts}
            candidateConflictDates={candidateConflictDates}
            allowConflictOverride={allowConflictOverride}
            isSubmitting={isSubmitting}
            timeValidation={timeValidation}
            enableSingleSecondSpace={enableSingleSecondSpace}
            singleSecondTimeValidation={singleSecondTimeValidation}
            bookingMode={bookingMode}
            generateFullSeries={generateFullSeries}
            specificDates={specificDates}
            generatedDates={generatedDates}
            isStep1Completed={isStep1Completed}
            isStep2Completed={isStep2Completed}
          />
        </form>
      </div>

      {/* Sub-modals & Overlays (Conflict resolution, Commitment letter, Deletion confirmation) */}
      <ReservationModalDialogs
        showConflictDialog={showConflictDialog}
        setShowConflictDialog={setShowConflictDialog}
        handleConfirmSaveFromConflictModal={handleConfirmSaveFromConflictModal}
        bookingMode={bookingMode}
        formData={formData}
        isEditingSingleOccurrence={isEditingSingleOccurrence}
        editingReservation={editingReservation}
        enableSingleSecondSpace={enableSingleSecondSpace}
        singleSecondSpace={singleSecondSpace}
        singleSecondStartTime={singleSecondStartTime}
        singleSecondEndTime={singleSecondEndTime}
        specificDates={specificDates}
        dateSchedules={dateSchedules}
        useCustomSchedulesPerDate={useCustomSchedulesPerDate}
        generatedDates={generatedDates}
        daySchedules={daySchedules}
        useCustomSchedulesPerDay={useCustomSchedulesPerDay}
        availableSpaces={availableSpaces}
        allReservations={allReservations}
        excludeReservationIds={excludeReservationIds}
        excludeSeriesId={excludeSeriesId}
        allowConflictOverride={allowConflictOverride}
        setFormData={setFormData}
        handleUpdateSecondSpace={handleUpdateSecondSpace}
        setSpecificDates={setSpecificDates}
        setDateSchedules={setDateSchedules}
        handleConvertToSpecificDates={handleConvertToSpecificDates}
        setAllowConflictOverride={setAllowConflictOverride}
        showCommitmentLetterModal={showCommitmentLetterModal}
        setShowCommitmentLetterModal={setShowCommitmentLetterModal}
        effectiveFormDataForLetter={effectiveFormDataForLetter}
        effectiveSeriesSlotsForLetter={effectiveSeriesSlotsForLetter}
        deleteConfirmModal={deleteConfirmModal}
        setDeleteConfirmModal={setDeleteConfirmModal}
      />
    </div>
  );
};

