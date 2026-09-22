import { useTimelineViewport, intersectsViewport } from '../hooks/useTimelineViewport';
import React, { useState, useMemo, useEffect, useRef, Suspense, useCallback } from 'react';
import { Reservation, SpaceInfo, FilterState, SpaceBlock } from '../types';
import { SPACES_LIST, normalizeSpaceName } from '../data/spacesData';
import { timeToMinutes, formatMinutesToTime, getConflictReservationIds } from '../utils/conflictDetector';
import { getChileanHolidayInfo } from '../utils/holidayUtils';
import {
  Calendar as CalendarIcon,
  Printer,
  Plus,
  Flame,
  Search,
  X,
  AlertTriangle,
  Edit2,
  Trash2,
  GripVertical,
  Check,
  Star,
  Copy,
  Filter,
  RotateCcw,
  Hammer
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  parseISO,
  isSameDay,
  isWithinInterval,
  startOfDay,
  endOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { validateStrictCalendarDate, clampAndFixCalendarDate } from '../utils/validationUtils';
import { useReservationDateIndex } from '../utils/reservationIndex';
import { formatActivitiesCount } from '../utils/pluralUtils';

const PrintScheduleModal = React.lazy(() =>
  import('./PrintScheduleModal').then((m) => ({ default: m.PrintScheduleModal }))
);

interface DailyUsageViewProps {
  reservations: Reservation[];
  allReservations?: Reservation[];
  conflictReservationIds?: Set<string>;
  spaceBlocks?: readonly SpaceBlock[];
  globalFilters?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  onClearGlobalFilters?: () => void;
  spaces?: SpaceInfo[];
  selectedDate?: Date;
  initialDate?: Date;
  onSelectReservation: (reserva: Reservation) => void;
  onEditReservation?: (reserva: Reservation) => void;
  onDuplicateReservation?: (reserva: Reservation) => void;
  onDeleteReservation?: (id: string, isSeries?: boolean, seriesId?: string) => void;
  onRequestDelete?: (reserva: Reservation) => void;
  onNewReservationWithSlot: (space: string, date: string, startTime: string, endTime: string) => void;
  onUpdateReservation?: (reserva: Reservation) => Promise<boolean | void> | boolean | void;
  onReorderSpaces?: (spaces: SpaceInfo[]) => void;
  onNavigateToMaintenance?: () => void;
  onDateChange?: (date: Date) => void;
}

// Format space display name into elegant Sentence Case
export const formatSpaceDisplayName = (name: string): string => {
  if (!name) return '';
  const specialNames: Record<string, string> = {
    'AUDITORIO': 'Auditorio',
    'GIMNASIO': 'Gimnasio',
    'SALA DE ESPEJOS': 'Sala de Espejos',
    'TATAMI': 'Tatami',
    'SALA 2': 'Sala 2',
    'SALA 3': 'Sala 3',
    'SALA 4': 'Sala 4',
    'SALA 5': 'Sala 5',
    'SALA 6': 'Sala 6',
    'BIBLIOTECA': 'Biblioteca',
    'PATIO EXTERIOR': 'Patio Exterior',
    'COCINA': 'Cocina',
    'MULTICANCHA': 'Multicancha',
    'BOX 1': 'Box 1'
  };
  const upper = name.trim().toUpperCase();
  return specialNames[upper] || (name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());
};

// Ordered space list matching the user's required layout exactly:
// Auditorio, Gimnasio, Sala Espejos, Tatami, Sala 2, Sala 3, Sala 4, Sala 5, Sala 6, Biblioteca, Patio Exterior
const ORDERED_SPACES: string[] = [
  'AUDITORIO',
  'GIMNASIO',
  'SALA DE ESPEJOS',
  'TATAMI',
  'SALA 2',
  'SALA 3',
  'SALA 4',
  'SALA 5',
  'SALA 6',
  'BIBLIOTECA',
  'PATIO EXTERIOR',
  'COCINA',
  'MULTICANCHA',
  'BOX 1'
];

export const DailyUsageView: React.FC<DailyUsageViewProps> = ({
  reservations,
  allReservations,
  conflictReservationIds,
  spaceBlocks = [],
  globalFilters,
  onFilterChange,
  onClearGlobalFilters,
  spaces = SPACES_LIST,
  selectedDate: propSelectedDate,
  initialDate,
  onSelectReservation,
  onEditReservation,
  onDuplicateReservation,
  onDeleteReservation,
  onRequestDelete,
  onNewReservationWithSlot,
  onUpdateReservation,
  onReorderSpaces,
  onNavigateToMaintenance,
  onDateChange
}) => {
  // Single controlled source of truth for the active date rendering the agenda.
  // Supports both controlled mode (via propSelectedDate) and uncontrolled mode (via initialDate).
  const [currentDate, setCurrentDate] = useState<Date>(() => propSelectedDate || initialDate || new Date());

  // Synchronize internal state when propSelectedDate changes from parent
  useEffect(() => {
    if (propSelectedDate) {
      setCurrentDate(propSelectedDate);
    }
  }, [propSelectedDate]);

  // Synchronize internal state if initialDate changes while propSelectedDate is not provided
  useEffect(() => {
    if (initialDate && !propSelectedDate) {
      setCurrentDate(initialDate);
    }
  }, [initialDate, propSelectedDate]);

  // The active date rendering the agenda is currentDate
  const selectedDate = currentDate;
  const [searchQuery, setSearchQuery] = useState<string>(() => globalFilters?.search || '');
  const [dateErrorMessage, setDateErrorMessage] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ space: string; hour: number } | null>(null);

  const updateSelectedDate = useCallback((newDate: Date) => {
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  }, [onDateChange]);

  // Drag & Drop State for Reservations
  const [draggedReservation, setDraggedReservation] = useState<Reservation | null>(null);
  const [dragTargetInfo, setDragTargetInfo] = useState<{
    spaceName: string;
    startMinutes: number;
    endMinutes: number;
    startTime: string;
    endTime: string;
    hasConflict?: boolean;
    conflictDetails?: string;
    isBlocked?: boolean;
    blockReason?: string;
  } | null>(null);
  const [dragOverHeaderSpace, setDragOverHeaderSpace] = useState<string | null>(null);

  // Drag & Drop State for Space Columns Reordering
  const [draggedHeaderIndex, setDraggedHeaderIndex] = useState<number | null>(null);
  const [dragOverHeaderIndex, setDragOverHeaderIndex] = useState<number | null>(null);

  // Notification feedback banner
  const [toastMessage, setToastMessage] = useState<{ text: string; sub?: string } | null>(null);

  // Print PDF Preview Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Clear toast after 3.5s

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const isToday = isSameDay(selectedDate, new Date());

  // High-performance pre-indexed date map: O(1) day retrieval
  const reservationIndex = useReservationDateIndex(reservations);
  const rawDayReservations = useMemo(() => {
    return reservationIndex.get(dateStr) || [];
  }, [reservationIndex, dateStr]);

  // Dynamic hours: baseline 08:00 - 22:00, automatically expanding earlier (down to 06:00) or later (up to 24:00)
  // when reservations are authorized outside regular operating hours
  const { startHour, endHour } = useMemo(() => {
    let minH = 8;
    let maxH = 22;
    for (const r of rawDayReservations) {
      const isOvernight = Boolean(r.terminaDiaSiguiente) || (timeToMinutes(r.horaFin) <= timeToMinutes(r.horaInicio) && timeToMinutes(r.horaFin) > 0);
      const isSecondDay = isOvernight && r.fecha !== dateStr;
      const sMin = isSecondDay ? 0 : timeToMinutes(r.horaInicio);
      const eMin = (isOvernight && !isSecondDay) ? (24 * 60) : timeToMinutes(r.horaFin);

      if (sMin >= 0) {
        const sHour = Math.floor(sMin / 60);
        if (sHour < minH) minH = Math.max(0, sHour);
      }
      if (eMin > 0) {
        const eHour = Math.ceil(eMin / 60);
        if (eHour > maxH) maxH = Math.min(24, eHour);
      }
    }
    return { startHour: minH, endHour: maxH };
  }, [rawDayReservations, dateStr]);

  const START_HOUR = startHour;
  const END_HOUR = endHour;
  const HOUR_HEIGHT = 68; // px per hour
  const START_MINUTES = START_HOUR * 60;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const TOTAL_MINUTES = TOTAL_HOURS * 60;
  const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

  // Calculate important reservations from 3 days prior
  const upcomingImportant3Days = useMemo(() => {
    try {
      const start = startOfDay(selectedDate);
      const end = endOfDay(addDays(selectedDate, 3));
      return reservations.filter((r) => {
        if (r.importante !== 'Sí') return false;
        if (!r.fecha) return false;
        const rDate = parseISO(r.fecha);
        if (isNaN(rDate.getTime())) return false;
        return isWithinInterval(rDate, { start, end });
      });
    } catch {
      return [];
    }
  }, [reservations, selectedDate]);


  // Fixed simulated current time for demo matching screenshot (15:06) or real local time
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(15 * 60 + 6); // 15:06 = 906 mins

  useEffect(() => {
    // If viewing real today, calculate current minutes
    const now = new Date();
    if (isSameDay(selectedDate, now)) {
      const updateNow = () => {
        const n = new Date();
        setCurrentTimeMinutes(n.getHours() * 60 + n.getMinutes());
      };
      updateNow();
      const interval = setInterval(updateNow, 60000);
      return () => clearInterval(interval);
    } else {
      // Default to 15:06 as in screenshot
      setCurrentTimeMinutes(15 * 60 + 6);
    }
  }, [selectedDate]);

  // Current time formatted
  const currentTimeFormatted = useMemo(() => {
    const h = Math.floor(currentTimeMinutes / 60);
    const m = currentTimeMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [currentTimeMinutes]);

  // Current time top position
  const currentTimeTop = useMemo(() => {
    if (currentTimeMinutes < START_MINUTES || currentTimeMinutes > START_MINUTES + TOTAL_MINUTES) {
      return null;
    }
    return ((currentTimeMinutes - START_MINUTES) / 60) * HOUR_HEIGHT;
  }, [currentTimeMinutes, START_MINUTES, TOTAL_MINUTES, HOUR_HEIGHT]);

  // Hour slots array: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
  const hourSlots = useMemo(() => {
    const slots: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      slots.push(h);
    }
    return slots;
  }, [START_HOUR, END_HOUR]);

  // Synchronize local search state with shared globalFilters
  useEffect(() => {
    if (globalFilters?.search !== undefined && globalFilters.search !== searchQuery) {
      setSearchQuery(globalFilters.search);
    }
  }, [globalFilters?.search]);

  // Handle search changes in DailyUsageView and propagate to globalFilters
  const handleDailySearchChange = (val: string) => {
    setSearchQuery(val);
    if (onFilterChange && globalFilters) {
      onFilterChange({ ...globalFilters, search: val });
    }
  };

  // Clear all filters handler (recovering all hidden activities)
  const handleClearAllFilters = () => {
    setSearchQuery('');
    if (onClearGlobalFilters) {
      onClearGlobalFilters();
    } else if (onFilterChange && globalFilters) {
      onFilterChange({
        ...globalFilters,
        search: '',
        espacio: '',
        tipoActividad: '',
        fechaDesde: '',
        fechaHasta: '',
        soloRecurrentes: false,
        soloImportantes: false,
        soloConTopamiento: false
      });
    }
  };

  // Total unfiltered reservations registered for this day (retrieved directly from index)
  const allReservationsForToday = useMemo(() => {
    return rawDayReservations;
  }, [rawDayReservations]);

  // Detect whether any global or local filter is currently active
  const hasActiveGlobalFilters = useMemo(() => {
    if (!globalFilters) return Boolean(searchQuery.trim());
    return (
      Boolean(globalFilters.search?.trim()) ||
      Boolean(globalFilters.espacio) ||
      Boolean(globalFilters.tipoActividad) ||
      Boolean(globalFilters.fechaDesde) ||
      Boolean(globalFilters.fechaHasta) ||
      Boolean(globalFilters.soloRecurrentes) ||
      Boolean(globalFilters.soloImportantes) ||
      Boolean(globalFilters.soloConTopamiento) ||
      Boolean(searchQuery.trim())
    );
  }, [globalFilters, searchQuery]);

  // User-friendly descriptions of active filters
  const activeFilterDescriptions = useMemo(() => {
    const list: string[] = [];
    if (globalFilters?.search?.trim()) list.push(`Búsqueda: "${globalFilters.search.trim()}"`);
    else if (searchQuery.trim()) list.push(`Búsqueda: "${searchQuery.trim()}"`);
    if (globalFilters?.espacio) list.push(`Espacio: ${globalFilters.espacio}`);
    if (globalFilters?.tipoActividad) list.push(`Tipo: ${globalFilters.tipoActividad}`);
    if (globalFilters?.soloImportantes) list.push(`Solo Importantes`);
    if (globalFilters?.soloRecurrentes) list.push(`Series Recurrentes`);
    if (globalFilters?.soloConTopamiento) list.push(`Con Topamiento`);
    return list;
  }, [globalFilters, searchQuery]);

  // Filter reservations for current day (operating only on day's reservations)
  const dayReservations = useMemo(() => {
    if (!searchQuery.trim()) {
      return rawDayReservations;
    }
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return rawDayReservations.filter((r) => {
      const normDesc = (r.descripcion || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normResp = (r.responsable || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normEsp = (r.espacio || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normTipo = (r.tipoActividad || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normDesc.includes(q) || normResp.includes(q) || normEsp.includes(q) || normTipo.includes(q);
    });
  }, [rawDayReservations, searchQuery]);

  // Normalize, map and strictly sort all spaces according to the canonical order (respecting active space filters)
  const activeSpaces = useMemo(() => {
    let list: SpaceInfo[] = [...spaces];

    // Check if day reservations have any space not in list
    const knownSpaces = new Set(list.map((s) => normalizeSpaceName(s.name)));
    dayReservations.forEach((r) => {
      const norm = normalizeSpaceName(r.espacio);
      if (norm && !knownSpaces.has(norm)) {
        knownSpaces.add(norm);
        list.push({
          id: norm,
          name: norm,
          capacity: 20,
          category: 'Salas de Clases',
          iconName: 'Layers',
          color: '#6366f1',
          description: norm
        });
      }
    });

    // If global space filter is active, filter space list
    if (globalFilters?.espacio && globalFilters.espacio.trim()) {
      const filterNorm = normalizeSpaceName(globalFilters.espacio);
      const filtered = list.filter((s) => normalizeSpaceName(s.name) === filterNorm);
      if (filtered.length > 0) {
        list = filtered;
      }
    }

    // Sort according to ORDERED_SPACES index
    return list.sort((a, b) => {
      const normA = normalizeSpaceName(a.name);
      const normB = normalizeSpaceName(b.name);
      const idxA = ORDERED_SPACES.indexOf(normA);
      const idxB = ORDERED_SPACES.indexOf(normB);
      const posA = idxA >= 0 ? idxA : 999;
      const posB = idxB >= 0 ? idxB : 999;
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name);
    });
  }, [spaces, dayReservations, globalFilters?.espacio]);


  // Conflict IDs for the day (utilizes precomputed global Set when provided for O(1) lookups)
  const conflictIdsToday = useMemo(() => {
    if (conflictReservationIds) {
      return conflictReservationIds;
    }
    return getConflictReservationIds(dayReservations);
  }, [conflictReservationIds, dayReservations]);

  // Redesigned styling: Clean white background, soft ambient shadow, rounded left accent strip
  const getCardStyle = (res: Reservation, isConflict: boolean) => {
    if (isConflict) {
      return {
        bg: 'bg-white',
        border: 'border-rose-300/80 ring-1 ring-rose-300/60',
        shadow: 'shadow-[0_2px_8px_rgba(244,63,94,0.12),0_1px_2px_rgba(0,0,0,0.04)]',
        text: 'text-slate-900',
        accent: '#f43f5e',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }

    const tipo = (res.tipoActividad || '').toUpperCase();
    const desc = (res.descripcion || '').toUpperCase();

    // 1. TALLER MUNICIPAL -> Sapphire Blue
    if (tipo.includes('MUNICIPAL') || desc.includes('MUNICIPAL')) {
      return {
        bg: 'bg-white',
        border: 'border-slate-200/80 hover:border-blue-300',
        shadow: 'shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]',
        text: 'text-slate-900',
        accent: '#3b82f6',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200'
      };
    }

    // 2. TALLER JJV -> Warm Amber Gold
    if (tipo.includes('JJV') || desc.includes('JJV') || tipo.includes('VECINAL')) {
      return {
        bg: 'bg-white',
        border: 'border-slate-200/80 hover:border-amber-300',
        shadow: 'shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]',
        text: 'text-slate-900',
        accent: '#f59e0b',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200'
      };
    }

    // 3. TALLER CCD / DEPORTES -> Soft Emerald / Mint
    if (tipo.includes('CCD') || desc.includes('CCD') || desc.includes('YOGA') || desc.includes('PILATES') || desc.includes('ZUMBA')) {
      return {
        bg: 'bg-white',
        border: 'border-slate-200/80 hover:border-emerald-300',
        shadow: 'shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]',
        text: 'text-slate-900',
        accent: '#10b981',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      };
    }

    // 4. PRÉSTAMO / CAM -> Nordic Teal
    if (tipo.includes('PRÉSTAMO') || tipo.includes('PRESTAMO') || desc.includes('CAM') || tipo.includes('CAM')) {
      return {
        bg: 'bg-white',
        border: 'border-slate-200/80 hover:border-teal-300',
        shadow: 'shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]',
        text: 'text-slate-900',
        accent: '#06b6d4',
        badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200'
      };
    }

    // 5. ENSAYO / BAILE / CUMPLEAÑOS -> Warm Coral Peach
    if (tipo.includes('ENSAYO') || desc.includes('BAILE') || tipo.includes('CUMPLEAÑOS') || desc.includes('DANZA')) {
      return {
        bg: 'bg-white',
        border: 'border-slate-200/80 hover:border-orange-300',
        shadow: 'shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]',
        text: 'text-slate-900',
        accent: '#f97316',
        badgeBg: 'bg-orange-50 text-orange-800 border-orange-200'
      };
    }

    // Default: Soft Violet / Lavender
    return {
      bg: 'bg-white',
      border: 'border-slate-200/80 hover:border-violet-300',
      shadow: 'shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]',
      text: 'text-slate-900',
      accent: '#8b5cf6',
      badgeBg: 'bg-violet-50 text-violet-800 border-violet-200'
    };
  };

  // --- DRAG & DROP HANDLERS FOR RESERVATIONS ---
  const handleReservationDragStart = (e: React.DragEvent, res: Reservation) => {
    e.stopPropagation();
    setDraggedReservation(res);
    e.dataTransfer.setData('text/plain', res.id);
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: res.id,
      espacio: res.espacio,
      horaInicio: res.horaInicio,
      horaFin: res.horaFin
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleReservationDragEnd = () => {
    setDraggedReservation(null);
    setDragTargetInfo(null);
    setDragOverHeaderSpace(null);
  };

  const handleColumnDragOver = (e: React.DragEvent, spaceName: string) => {
    if (!draggedReservation) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Calculate Y offset relative to timetable body
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;

    // Snapping to 15-minute intervals
    const origStartMin = timeToMinutes(draggedReservation.horaInicio);
    const origEndMin = timeToMinutes(draggedReservation.horaFin);
    const duration = Math.max(30, origEndMin - origStartMin);

    const relativeMinutes = (offsetY / HOUR_HEIGHT) * 60;
    const rawTargetStart = START_MINUTES + relativeMinutes;
    // Snap to nearest 15 mins
    const snappedStart = Math.round(rawTargetStart / 15) * 15;
    const clampedStart = Math.max(START_MINUTES, Math.min(START_MINUTES + TOTAL_MINUTES - duration, snappedStart));
    const clampedEnd = clampedStart + duration;

    const startTimeStr = formatMinutesToTime(clampedStart);
    const endTimeStr = formatMinutesToTime(clampedEnd);

    // Detect active maintenance blocks in this slot
    const normTargetSpace = normalizeSpaceName(spaceName);
    const matchingBlock = spaceBlocks?.find((b) => {
      if (!b.activo) return false;
      if (dateStr < b.fechaInicio || dateStr > b.fechaFin) return false;
      const bNorm = normalizeSpaceName(b.espacio);
      const sNorm = normTargetSpace;
      const matchesSpace =
        bNorm === sNorm ||
        (b.bloquearSubEspacios && sNorm.includes(bNorm)) ||
        (b.bloquearSubEspacios && bNorm.includes(sNorm));
      if (!matchesSpace) return false;
      if (b.todoElDia) return true;
      const bStart = timeToMinutes(b.horaInicio || '08:00');
      const bEnd = timeToMinutes(b.horaFin || '22:30');
      return bStart < clampedEnd && clampedStart < bEnd;
    });

    // Detect conflicting reservations in this space and time (excluding current reservation being dragged)
    const conflictingRes = rawDayReservations.find((r) => {
      if (r.id === draggedReservation.id) return false;
      if (r.estado === 'cancelada' || r.estado === 'rechazada' || r.estado === 'eliminada') return false;
      if (normalizeSpaceName(r.espacio) !== normTargetSpace) return false;
      const rStart = timeToMinutes(r.horaInicio);
      let rEnd = timeToMinutes(r.horaFin);
      if ((r.horaFin === '00:00' || r.horaFin === '24:00' || rEnd === 0) && rStart > 0 && !r.terminaDiaSiguiente) {
        rEnd = 1440;
      }
      return rStart < clampedEnd && clampedStart < rEnd;
    });

    setDragTargetInfo({
      spaceName,
      startMinutes: clampedStart,
      endMinutes: clampedEnd,
      startTime: startTimeStr,
      endTime: endTimeStr,
      hasConflict: !!conflictingRes,
      conflictDetails: conflictingRes ? `${conflictingRes.descripcion || conflictingRes.tipoActividad} (${conflictingRes.horaInicio} – ${conflictingRes.horaFin})` : undefined,
      isBlocked: !!matchingBlock,
      blockReason: matchingBlock ? `${matchingBlock.motivo || 'Mantención'}${matchingBlock.descripcion ? `: ${matchingBlock.descripcion}` : ''}` : undefined
    });
  };

  const handleColumnDrop = async (e: React.DragEvent, spaceName: string) => {
    e.preventDefault();
    if (!draggedReservation || !dragTargetInfo || !onUpdateReservation) {
      setDraggedReservation(null);
      setDragTargetInfo(null);
      setDragOverHeaderSpace(null);
      return;
    }

    // Check if dropping on the exact same space and time (no-op)
    const isSameSpace = normalizeSpaceName(draggedReservation.espacio) === normalizeSpaceName(spaceName);
    const isSameStart = draggedReservation.horaInicio === dragTargetInfo.startTime;
    const isSameEnd = draggedReservation.horaFin === dragTargetInfo.endTime;
    if (isSameSpace && isSameStart && isSameEnd) {
      setDraggedReservation(null);
      setDragTargetInfo(null);
      setDragOverHeaderSpace(null);
      return;
    }

    // Block moving to a space with active maintenance block
    if (dragTargetInfo.isBlocked) {
      setToastMessage({
        text: 'Reubicación cancelada: Espacio en mantención',
        sub: `${spaceName}: ${dragTargetInfo.blockReason || 'Bloqueo activo en este horario'}`
      });
      setDraggedReservation(null);
      setDragTargetInfo(null);
      setDragOverHeaderSpace(null);
      return;
    }

    const updatedRes: Reservation = {
      ...draggedReservation,
      espacio: spaceName,
      horaInicio: dragTargetInfo.startTime,
      horaFin: dragTargetInfo.endTime
    };

    const prevRes = draggedReservation;
    setDraggedReservation(null);
    setDragTargetInfo(null);
    setDragOverHeaderSpace(null);

    const result = await Promise.resolve(onUpdateReservation(updatedRes));
    if (result !== false) {
      setToastMessage({
        text: 'Actividad reasignada exitosamente',
        sub: `${prevRes.tipoActividad || 'Reserva'} en ${spaceName} (${updatedRes.horaInicio} – ${updatedRes.horaFin})`
      });
    }
  };

  const handleHeaderDrop = async (e: React.DragEvent, targetSpaceName: string) => {
    e.preventDefault();
    if (!draggedReservation || !onUpdateReservation) return;

    if (normalizeSpaceName(draggedReservation.espacio) === normalizeSpaceName(targetSpaceName)) {
      setDraggedReservation(null);
      setDragTargetInfo(null);
      setDragOverHeaderSpace(null);
      return;
    }

    const updatedRes: Reservation = {
      ...draggedReservation,
      espacio: targetSpaceName
    };

    const prevRes = draggedReservation;
    setDraggedReservation(null);
    setDragTargetInfo(null);
    setDragOverHeaderSpace(null);

    const result = await Promise.resolve(onUpdateReservation(updatedRes));
    if (result !== false) {
      setToastMessage({
        text: 'Espacio reasignado exitosamente',
        sub: `${prevRes.tipoActividad || 'Reserva'} ahora en ${targetSpaceName} (${updatedRes.horaInicio} – ${updatedRes.horaFin})`
      });
    }
  };

  // --- DRAG & DROP FOR SPACE COLUMNS REORDERING ---
  const handleHeaderDragStart = (e: React.DragEvent, index: number) => {
    setDraggedHeaderIndex(index);
    e.dataTransfer.setData('text/plain', `COL_${index}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleHeaderDragOver = (e: React.DragEvent, index: number) => {
    if (draggedHeaderIndex === null) {
      // If we are dragging a reservation over the header
      if (draggedReservation) {
        e.preventDefault();
        const sp = activeSpaces[index];
        if (sp) setDragOverHeaderSpace(sp.name);
      }
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverHeaderIndex(index);
  };

  const handleHeaderColumnDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedHeaderIndex === null || draggedHeaderIndex === targetIndex || !onReorderSpaces) {
      setDraggedHeaderIndex(null);
      setDragOverHeaderIndex(null);
      return;
    }

    const reordered = [...activeSpaces];
    const [moved] = reordered.splice(draggedHeaderIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    onReorderSpaces(reordered);
    setToastMessage({
      text: `Orden de espacios actualizado`,
      sub: `Columna "${moved.name}" reubicada`
    });

    setDraggedHeaderIndex(null);
    setDragOverHeaderIndex(null);
  };

  // Quick navigation handlers
  const handlePrevDay = () => updateSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => updateSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => updateSelectedDate(new Date());

  // Compute overlap lanes once per data change, never once per scroll frame.
  const bookingsBySpace = useMemo(() => new Map(activeSpaces.map(space => {
    const getBookingInterval = (r: Reservation) => {
      const isOvernight = Boolean(r.terminaDiaSiguiente) || (timeToMinutes(r.horaFin) <= timeToMinutes(r.horaInicio) && timeToMinutes(r.horaFin) > 0);
      const isSecondDay = isOvernight && r.fecha !== dateStr;
      const s = isSecondDay ? 0 : timeToMinutes(r.horaInicio);
      const e = (isOvernight && !isSecondDay) ? (24 * 60) : timeToMinutes(r.horaFin);
      return { s, e, isOvernight, isSecondDay };
    };

    const spaceBookings = dayReservations
      .filter((r) => normalizeSpaceName(r.espacio) === normalizeSpaceName(space.name))
      .sort((a, b) => {
        const intA = getBookingInterval(a);
        const intB = getBookingInterval(b);
        const startDiff = intA.s - intB.s;
        if (startDiff !== 0) return startDiff;
        return intB.e - intA.e;
      });

    // Calculate non-overlapping sub-column layout for concurrent bookings
    const layoutMap = new Map<string, { colIndex: number; totalCols: number }>();
    if (spaceBookings.length > 0) {
      const clusters: Reservation[][] = [];
      let currentCluster: Reservation[] = [];
      let clusterEnd = -1;

      spaceBookings.forEach((b) => {
        const bInt = getBookingInterval(b);
        if (currentCluster.length === 0) {
          currentCluster.push(b);
          clusterEnd = bInt.e;
        } else if (bInt.s < clusterEnd) {
          currentCluster.push(b);
          clusterEnd = Math.max(clusterEnd, bInt.e);
        } else {
          clusters.push(currentCluster);
          currentCluster = [b];
          clusterEnd = bInt.e;
        }
      });
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }

      clusters.forEach((cluster) => {
        if (cluster.length === 1) {
          layoutMap.set(cluster[0].id, { colIndex: 0, totalCols: 1 });
          return;
        }
        const cols: Reservation[][] = [];
        cluster.forEach((b) => {
          const bInt = getBookingInterval(b);
          let placed = false;
          for (let c = 0; c < cols.length; c++) {
            const lastInCol = cols[c][cols[c].length - 1];
            const lastInt = getBookingInterval(lastInCol);
            if (lastInt.e <= bInt.s) {
              cols[c].push(b);
              layoutMap.set(b.id, { colIndex: c, totalCols: 0 });
              placed = true;
              break;
            }
          }
          if (!placed) {
            cols.push([b]);
            layoutMap.set(b.id, { colIndex: cols.length - 1, totalCols: 0 });
          }
        });
        const totalColumnsInCluster = cols.length;
        cluster.forEach((b) => {
          const entry = layoutMap.get(b.id);
          if (entry) {
            entry.totalCols = totalColumnsInCluster;
          }
        });
      });
    }


    const geometry = new Map(spaceBookings.map(res => {
      const { s, e } = getBookingInterval(res);
      const from = Math.max(s, START_MINUTES);
      const to = Math.min(e, START_MINUTES + TOTAL_MINUTES);
      return [res.id, { top: ((from - START_MINUTES) / 60) * HOUR_HEIGHT + 2,
        height: Math.max(38, ((to - from) / 60) * HOUR_HEIGHT) - 4, valid: to > from }];
    }));
    return [space.id, { spaceBookings, layoutMap, getBookingInterval, geometry }] as const;
  })), [activeSpaces, dayReservations, dateStr, START_MINUTES, TOTAL_MINUTES]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const headerRef = useRef<HTMLDivElement>(null);
  const viewport = useTimelineViewport(scrollContainerRef, headerRef, TOTAL_HOURS, HOUR_HEIGHT);
  const [focusedReservationId, setFocusedReservationId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);

  // Auto scroll horizontally or vertically on mount if needed
  useEffect(() => {
    if (scrollContainerRef.current && currentTimeTop) {
      const targetScroll = Math.max(0, currentTimeTop - 180);
      scrollContainerRef.current.scrollTop = targetScroll;
    }
  }, [selectedDate]);

  return (
    <div className="w-full space-y-2 pb-1 relative">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{toastMessage.text}</div>
            {toastMessage.sub && (
              <div className="text-[11px] text-slate-300 font-mono">{toastMessage.sub}</div>
            )}
          </div>
        </div>
      )}

      {/* Consolidated Status Ribbon for Daily View (Holiday and/or Conflicts) */}
      {(conflictIdsToday.size > 0 || getChileanHolidayInfo(dateStr)) && (
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs text-xs backdrop-blur-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {getChileanHolidayInfo(dateStr) && (
              <div className="flex items-center gap-1.5 text-rose-900 font-medium">
                <span className="text-base leading-none">🇨🇱</span>
                <span className="font-semibold">{getChileanHolidayInfo(dateStr)?.name}</span>
                <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-rose-100 text-rose-800 rounded-md border border-rose-200/70">
                  {getChileanHolidayInfo(dateStr)?.isIrrenunciable ? 'Feriado Irrenunciable' : 'Feriado Oficial'}
                </span>
              </div>
            )}

            {getChileanHolidayInfo(dateStr) && conflictIdsToday.size > 0 && (
              <span className="text-slate-300 hidden sm:inline">•</span>
            )}

            {conflictIdsToday.size > 0 && (
              <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  <strong>{conflictIdsToday.size}</strong> {conflictIdsToday.size === 1 ? 'cruce de horario detectado' : 'cruces de horario detectados'}
                </span>
                <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-md border border-amber-200/70">
                  Borde rojo
                </span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            {getChileanHolidayInfo(dateStr) && (
              <span>
                {dayReservations.length === 0 ? 'Sin reservas' : `${dayReservations.length} autorizada(s)`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 1. TOP HEADER TOOLBAR (Sticky / Frozen) */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-4 sm:px-5 lg:px-6 py-3 shadow-sm flex flex-col md:flex-row lg:items-center justify-between gap-3">
        {/* Left Side: Date pill card with green "HOY" badge */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <div className="flex items-center space-x-2.5 px-3.5 py-1.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
            <span className="text-sm md:text-base font-bold text-slate-800 capitalize">
              {format(selectedDate, "EEEE, dd-MM-yyyy", { locale: es })}
            </span>
            {isToday && (
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#059669] text-white tracking-wider shadow-2xs">
                HOY
              </span>
            )}
            {getChileanHolidayInfo(dateStr) && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center space-x-1 shadow-2xs">
                <span>🇨🇱</span>
                <span>Feriado</span>
              </span>
            )}
          </div>

          {hasActiveGlobalFilters && (
            <div className="flex items-center space-x-1.5 text-xs text-blue-800 bg-blue-50 px-2.5 py-1 min-h-[44px] rounded-lg border border-blue-200">
              <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                Filtrado ({dayReservations.length}/{allReservationsForToday.length})
              </span>
              <button
                type="button"
                id="btn-clear-daily-top-filter"
                aria-label="Limpiar filtro de búsqueda"
                onClick={handleClearAllFilters}
                className="hover:text-blue-900 ml-1 p-1 rounded hover:bg-blue-100 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                title="Limpiar filtros"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Action and Date Navigation controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Navegación cronológica en bloque unificado */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 shadow-2xs min-h-[44px]">
            {/* Anterior */}
            <button
              id="btn-schedule-prev"
              aria-label="Ir al día anterior"
              onClick={handlePrevDay}
              className="px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:text-slate-900 transition cursor-pointer flex items-center justify-center space-x-1"
            >
              <span>◀</span>
              <span className="hidden sm:inline">Anterior</span>
            </button>

            {/* Hoy */}
            <button
              id="btn-schedule-today"
              aria-label="Ir a la fecha de hoy"
              onClick={handleToday}
              className="px-3.5 py-2 min-h-[44px] min-w-[44px] rounded-lg text-xs font-bold bg-[#64748b] hover:bg-[#475569] text-white shadow-2xs transition cursor-pointer flex items-center justify-center"
            >
              Hoy
            </button>

            {/* Siguiente */}
            <button
              id="btn-schedule-next"
              aria-label="Ir al día siguiente"
              onClick={handleNextDay}
              className="px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:text-slate-900 transition cursor-pointer flex items-center justify-center space-x-1"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <span>▶</span>
            </button>
          </div>

          {/* Ir a fecha Picker input pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 min-h-[44px] bg-white border border-slate-200 rounded-xl text-xs shadow-2xs focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <span className="text-slate-500 font-semibold whitespace-nowrap text-[11px]">Ir a fecha:</span>
            <input
              id="input-goto-date"
              aria-label="Seleccionar fecha para ver el horario"
              type="date"
              min="2020-01-01"
              max="2035-12-31"
              value={dateStr}
              onChange={(e) => {
                const rawVal = e.target.value;
                if (rawVal) {
                  const { correctedIso, wasAdjusted, message } = clampAndFixCalendarDate(rawVal);
                  const targetVal = correctedIso || rawVal;
                  const validation = validateStrictCalendarDate(targetVal, 2020, 2035);
                  if (validation.isValid && validation.date) {
                    setDateErrorMessage(null);
                    updateSelectedDate(validation.date);
                    if (wasAdjusted && message) {
                      setToastMessage({
                        text: 'Fecha ajustada automáticamente',
                        sub: message
                      });
                    }
                  } else {
                    setDateErrorMessage(validation.error || 'Fecha no válida.');
                    setTimeout(() => setDateErrorMessage(null), 6000);
                  }
                }
              }}
              className="px-1 py-1 text-xs text-slate-700 font-mono font-medium focus:outline-none bg-transparent cursor-pointer min-h-[36px]"
            />
          </div>

          {/* Quick Filter in Daily Timeline */}
          <div className="relative flex items-center">
            <label htmlFor="input-daily-search" className="sr-only">
              Buscar actividades en este día
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="input-daily-search"
              type="text"
              aria-label="Buscar actividades en este día"
              placeholder="Buscar en este día..."
              value={searchQuery}
              onChange={(e) => handleDailySearchChange(e.target.value)}
              className="pl-8 pr-7 py-2 min-h-[44px] text-xs bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 sm:w-40 lg:w-48 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Limpiar búsqueda del día"
                onClick={handleClearAllFilters}
                className="absolute right-1.5 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                title="Borrar búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Imprimir / Exportar PDF */}
          <button
            id="btn-print-schedule"
            aria-label="Imprimir o exportar esta planilla como PDF"
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold bg-[#eff6ff] hover:bg-[#dbeafe] text-[#0369a1] border border-[#bfdbfe] shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
            title="Imprimir o exportar esta planilla como PDF oficial"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir/Exportar</span>
          </button>
        </div>
      </div>

      {/* Active Global / Daily Filters Notification Bar */}
      {hasActiveGlobalFilters && (
        <div
          id="daily-active-filters-banner"
          className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs text-xs text-blue-950"
        >
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="font-bold text-blue-900">Filtro activo compartido:</span>
            {activeFilterDescriptions.map((desc, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-white border border-blue-200 rounded-lg text-blue-800 text-[11px] font-semibold"
              >
                {desc}
              </span>
            ))}
            <span className="text-[11px] text-blue-700 ml-1">
              (Mostrando <strong>{dayReservations.length}</strong> de <strong>{formatActivitiesCount(allReservationsForToday.length)}</strong> del día)
            </span>
          </div>
          <button
            type="button"
            id="btn-clear-daily-filters"
            onClick={handleClearAllFilters}
            className="px-3 py-1 bg-white hover:bg-blue-100 active:scale-95 text-blue-700 border border-blue-300 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3 h-3 text-blue-600" />
            <span>Limpiar filtros</span>
          </button>
        </div>
      )}

      {/* Differentiated Empty State Banner when no reservations match */}
      {dayReservations.length === 0 && (
        allReservationsForToday.length > 0 ? (
          <div
            id="banner-no-matches-filtered"
            className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-950 animate-fadeIn"
          >
            <div className="flex items-center space-x-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                <Search className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <div className="text-sm font-bold text-amber-950">
                  Sin coincidencias con los filtros activos para este día
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Hay <strong>{formatActivitiesCount(allReservationsForToday.length)} programadas</strong> en esta fecha ({format(selectedDate, 'dd-MM-yyyy')}) que están ocultas por el filtro actual ({activeFilterDescriptions.join(', ')}).
                </p>
              </div>
            </div>
            <button
              type="button"
              id="btn-recover-filtered-reservations"
              onClick={handleClearAllFilters}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs transition shadow-xs flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros (Recuperar {formatActivitiesCount(allReservationsForToday.length)})</span>
            </button>
          </div>
        ) : (
          <div
            id="banner-no-reservations-today"
            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center space-x-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                <CalendarIcon className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">
                  Sin reservas programadas para este día
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  No se registran actividades agendadas en ningún espacio para el {format(selectedDate, 'EEEE, dd-MM-yyyy', { locale: es })}.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNewReservationWithSlot(ORDERED_SPACES[0], dateStr, '10:00', '11:00')}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs transition shadow-2xs flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar Reserva</span>
            </button>
          </div>
        )
      )}

      {/* Invalid date feedback alert if triggered */}
      {dateErrorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{dateErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setDateErrorMessage(null)}
            className="text-rose-700 hover:text-rose-950 font-bold text-sm ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1.1 AVISO ACTIVIDADES IMPORTANTES (Desde 3 días antes) */}
      {upcomingImportant3Days.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 rounded-lg bg-amber-200 text-amber-900 font-extrabold flex items-center space-x-1 shadow-2xs">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-700" />
            </span>
            <div>
              <div className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                <span>Actividades Importantes en los Próximos 3 Días</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-extrabold">
                  {upcomingImportant3Days.length}
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                Se detectaron actividades destacadas entre el {format(selectedDate, 'dd-MM-yyyy')} y el{' '}
                {format(addDays(selectedDate, 3), 'dd-MM-yyyy')}. Puedes revisarlas o imprimirlas en la planilla.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Planilla Diaria</span>
          </button>
        </div>
      )}


      {/* 2. MAIN HORIZONTAL/VERTICAL DAILY TIMETABLE GRID */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-140px)] min-h-0 h-[calc(100dvh-140px)] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
        >
          <div className="min-w-[1320px] relative">
            {/* STICKY HEADER ROW: "HORA" + All Space Columns */}
            <div ref={headerRef} className="sticky top-0 z-30 flex border-b border-slate-200/80 bg-slate-50/95 backdrop-blur-sm text-xs font-semibold text-slate-700 shadow-2xs">
              {/* Left "HORA" header */}
              <div className="w-[72px] shrink-0 p-2.5 text-center text-[10px] font-bold tracking-wider text-slate-400 border-r border-slate-100 bg-slate-50/90 flex items-center justify-center select-none">
                HORA
              </div>

              {/* Space Column Headers (Draggable & Drop Target) */}
              {activeSpaces.map((space, idx) => {
                const isSpecial = space.name === 'SALA 4';
                const isHeaderDragged = draggedHeaderIndex === idx;
                const isHeaderDropTarget = dragOverHeaderIndex === idx;
                const isReservationHeaderTarget = dragOverHeaderSpace === space.name;

                return (
                  <div
                    key={space.id}
                    draggable
                    onDragStart={(e) => handleHeaderDragStart(e, idx)}
                    onDragOver={(e) => handleHeaderDragOver(e, idx)}
                    onDragLeave={() => {
                      if (dragOverHeaderIndex === idx) setDragOverHeaderIndex(null);
                      if (dragOverHeaderSpace === space.name) setDragOverHeaderSpace(null);
                    }}
                    onDrop={(e) => {
                      if (draggedReservation) {
                        handleHeaderDrop(e, space.name);
                      } else {
                        handleHeaderColumnDrop(e, idx);
                      }
                    }}
                    className={`flex-1 min-w-[100px] p-2.5 text-center text-xs font-semibold tracking-normal border-r border-slate-100 truncate transition-all cursor-grab active:cursor-grabbing select-none relative group/header ${
                      isReservationHeaderTarget
                        ? 'bg-blue-50 text-blue-900 ring-2 ring-blue-500 ring-inset scale-[1.02] z-40'
                        : isHeaderDropTarget
                        ? 'bg-amber-50 text-amber-900 border-l-4 border-l-amber-500'
                        : isHeaderDragged
                        ? 'opacity-40 bg-slate-200'
                        : isSpecial
                        ? 'bg-[#fffaf5] text-amber-900'
                        : 'bg-slate-50/80 text-slate-700 hover:bg-slate-100/90'
                    }`}
                    title={`Arrastra para reordenar columna o suelta aquí una reserva para asignarla a ${space.name}`}
                  >
                    <div className="flex items-center justify-center space-x-1 truncate">
                      <GripVertical className="w-3 h-3 text-slate-400 opacity-0 group-hover/header:opacity-100 transition shrink-0" />
                      <span className="truncate block font-semibold text-slate-700">{formatSpaceDisplayName(space.name)}</span>
                    </div>
                    {isReservationHeaderTarget && (
                      <span className="text-[9px] font-bold text-blue-600 block leading-tight">
                        🎯 Soltar aquí
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* GRID BODY: Left time labels + Space Columns + Time Line + Floating Event Cards */}
            <div className="relative flex" style={{ height: `${TOTAL_HEIGHT}px` }}>
              {/* 1. LEFT TIME COLUMN (08:00 to 22:00) */}
              <div className="w-[72px] shrink-0 bg-[#f8fafc] border-r border-slate-200 relative select-none z-20">
                {hourSlots.map((h, i) => {
                  const topPx = i * HOUR_HEIGHT;
                  const hourLabel = `${String(h).padStart(2, '0')}:00`;

                  return (
                    <div
                      key={h}
                      style={{ top: `${topPx}px` }}
                      className="absolute left-0 right-0 h-[68px] border-b border-slate-200 flex items-start justify-center pt-2 text-[11px] font-semibold font-mono text-slate-500"
                    >
                      {hourLabel}
                    </div>
                  );
                })}

                {/* RED BADGE FOR CURRENT TIME (e.g. "15:06") */}
                {isToday && currentTimeTop !== null && (
                  <div
                    style={{ top: `${currentTimeTop - 11}px` }}
                    className="absolute left-1.5 z-40 bg-[#dc2626] text-white text-[10.5px] font-mono font-extrabold px-1.5 py-0.5 rounded shadow-sm text-center leading-none"
                  >
                    {currentTimeFormatted}
                  </div>
                )}
              </div>

              {/* 2. SPACE COLUMNS & GRID BACKGROUND */}
              <div className="flex-1 flex relative">
                {/* Horizontal Hour Lines */}
                <div className="absolute inset-0 pointer-events-none z-0">
                  {hourSlots.map((h, i) => (
                    <div
                      key={h}
                      style={{ top: `${i * HOUR_HEIGHT}px` }}
                      className="w-full border-b border-slate-100 h-[68px]"
                    />
                  ))}
                </div>

                {/* CURRENT TIME RED HORIZONTAL LINE ACROSS ALL COLUMNS */}
                {isToday && currentTimeTop !== null && (
                  <div
                    style={{ top: `${currentTimeTop}px` }}
                    className="absolute left-0 right-0 h-[2px] bg-[#dc2626] z-30 pointer-events-none shadow-xs"
                  >
                    <div className="absolute -top-1 -bottom-1 left-0 right-0 bg-red-500/10 pointer-events-none" />
                  </div>
                )}

                {/* Space Columns Container (Droppable Zones) */}
                {activeSpaces.map((space) => {
                  const { spaceBookings, layoutMap, getBookingInterval, geometry } = bookingsBySpace.get(space.id)!;
                  const isSpecial = space.name === 'SALA 4';
                  const isDragTarget = dragTargetInfo?.spaceName === space.name;

                  return (
                    <div
                      key={space.id}
                      onDragOver={(e) => handleColumnDragOver(e, space.name)}
                      onDragLeave={() => {
                        if (dragTargetInfo?.spaceName === space.name) {
                          setDragTargetInfo(null);
                        }
                      }}
                      onDrop={(e) => handleColumnDrop(e, space.name)}
                      className={`flex-1 min-w-[100px] border-r border-slate-200/80 relative transition group/col ${
                        isDragTarget
                          ? 'bg-blue-50/40 ring-2 ring-blue-400/80 ring-inset'
                          : isSpecial
                          ? 'bg-[#fffaf5]/40'
                          : 'bg-transparent'
                      }`}
                    >
                      {/* Clickable hourly slots for quick booking creation */}
                      {hourSlots.slice(0, -1).map((h, i) => {
                        const topPx = i * HOUR_HEIGHT;
                        const startH = `${String(h).padStart(2, '0')}:00`;
                        const endH = `${String(h + 1).padStart(2, '0')}:00`;

                        return (
                          <button
                            type="button"
                            key={h}
                            style={{ top: `${topPx}px`, height: `${HOUR_HEIGHT}px` }}
                            onKeyDown={event => {
                              if (event.key !== 'Tab') return;
                              let next: Reservation | undefined;
                              let nextGeometry = geometry;
                              if (!event.shiftKey && i === TOTAL_HOURS - 1) next = spaceBookings[0];
                              if (event.shiftKey && i === 0) {
                                const previousSpace = activeSpaces[activeSpaces.indexOf(space) - 1];
                                const previous = previousSpace && bookingsBySpace.get(previousSpace.id);
                                if (previous) {
                                  next = previous.spaceBookings[previous.spaceBookings.length - 1];
                                  nextGeometry = previous.geometry;
                                }
                              }
                              if (next) {
                                event.preventDefault();
                                pendingFocus.current = next.id;
                                setFocusedReservationId(next.id);
                                scrollContainerRef.current?.scrollTo({ top: Math.max(0, nextGeometry.get(next.id)!.top - 10) });
                              }
                            }}
                            onClick={() => onNewReservationWithSlot(space.name, dateStr, startH, endH)}
                            onMouseEnter={() => setHoveredSlot({ space: space.name, hour: h })}
                            onMouseLeave={() => setHoveredSlot(null)}
                            aria-label={`Reservar ${space.name} a las ${startH}`}
                            className="absolute inset-x-0 w-full text-left bg-transparent border-0 cursor-pointer hover:bg-blue-50/30 transition-colors z-5 flex items-center justify-center group/cell p-0"
                            title={`Haga clic para reservar en ${space.name} a las ${startH}`}
                          >
                            <span className="opacity-0 group-hover/cell:opacity-100 text-[10px] font-semibold text-blue-600 bg-white/80 px-1.5 py-0.5 rounded shadow-2xs transition pointer-events-none">
                              + Reservar
                            </span>
                          </button>
                        );
                      })}


                      {/* ACTIVE MAINTENANCE / SPACE BLOCKS OVERLAY */}
                      {spaceBlocks
                        .filter((b) => {
                          if (!b.activo) return false;
                          if (dateStr < b.fechaInicio || dateStr > b.fechaFin) return false;
                          const bNorm = normalizeSpaceName(b.espacio);
                          const sNorm = normalizeSpaceName(space.name);
                          return bNorm === sNorm ||
                            (b.bloquearSubEspacios && sNorm.includes(bNorm)) ||
                            (b.bloquearSubEspacios && bNorm.includes(sNorm));
                        })
                        .map((block) => {
                          const bStartMin = block.todoElDia ? START_MINUTES : timeToMinutes(block.horaInicio || '08:00');
                          const bEndMin = block.todoElDia ? (START_MINUTES + TOTAL_MINUTES) : timeToMinutes(block.horaFin || '22:30');
                          const clampStart = Math.max(bStartMin, START_MINUTES);
                          const clampEnd = Math.min(bEndMin, START_MINUTES + TOTAL_MINUTES);
                          if (clampEnd <= clampStart) return null;

                          const blockTop = ((clampStart - START_MINUTES) / 60) * HOUR_HEIGHT;
                          const blockHeight = Math.max(34, ((clampEnd - clampStart) / 60) * HOUR_HEIGHT);

                          if (!intersectsViewport(blockTop, blockHeight, viewport.start, viewport.end)) return null;
                          return (
                            <div
                              key={block.id}
                              style={{ top: `${blockTop}px`, height: `${blockHeight}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigateToMaintenance) onNavigateToMaintenance();
                              }}
                              className="absolute left-0.5 right-0.5 z-15 rounded-xl bg-amber-100/90 border-2 border-dashed border-amber-500/80 p-2 overflow-hidden shadow-xs cursor-pointer hover:bg-amber-200/90 transition flex flex-col justify-between"
                              title={`🚧 ${block.motivo}: ${block.descripcion} (${block.todoElDia ? 'Todo el día' : `${block.horaInicio} - ${block.horaFin}`})`}
                            >
                              <div className="flex items-center space-x-1 text-amber-900 font-extrabold text-[10px]">
                                <Hammer className="w-3 h-3 text-amber-700 shrink-0" />
                                <span className="uppercase tracking-tight truncate">{block.motivo}</span>
                              </div>
                              <p className="text-[9.5px] text-amber-800 font-medium line-clamp-2 leading-tight">
                                {block.descripcion}
                              </p>
                              <div className="text-[9px] font-mono text-amber-700 font-bold">
                                {block.todoElDia ? 'Jornada Completa' : `${block.horaInicio} - ${block.horaFin}`}
                              </div>
                            </div>
                          );
                        })}

                      {/* GHOST PREVIEW DROP TARGET INDICATOR */}
                      {isDragTarget && dragTargetInfo && (
                        <div
                          style={{
                            top: `${((dragTargetInfo.startMinutes - START_MINUTES) / 60) * HOUR_HEIGHT}px`,
                            height: `${Math.max(42, ((dragTargetInfo.endMinutes - dragTargetInfo.startMinutes) / 60) * HOUR_HEIGHT)}px`
                          }}
                          className={`absolute left-1 right-1 rounded-xl border-2 border-dashed z-30 pointer-events-none flex flex-col items-center justify-center p-1.5 shadow-lg transition-all ${
                            dragTargetInfo.isBlocked
                              ? 'bg-amber-500/25 border-amber-600 text-amber-950 ring-2 ring-amber-400/40'
                              : dragTargetInfo.hasConflict
                              ? 'bg-rose-500/25 border-rose-600 text-rose-950 ring-2 ring-rose-400/40'
                              : 'bg-blue-500/20 border-blue-600 text-blue-900 ring-2 ring-blue-400/30'
                          }`}
                        >
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] font-extrabold bg-white/95 px-2 py-0.5 rounded shadow-xs">
                              📍 {dragTargetInfo.startTime} – {dragTargetInfo.endTime}
                            </span>
                          </div>
                          {dragTargetInfo.isBlocked ? (
                            <span className="text-[9px] font-bold text-amber-950 bg-amber-100/90 px-1.5 py-0.2 rounded mt-0.5 truncate max-w-[95%]">
                              🚧 {dragTargetInfo.blockReason || 'Espacio en mantención'}
                            </span>
                          ) : dragTargetInfo.hasConflict ? (
                            <span className="text-[9px] font-bold text-rose-950 bg-rose-100/90 px-1.5 py-0.2 rounded mt-0.5 truncate max-w-[95%]">
                              ⚠️ Topamiento con {dragTargetInfo.conflictDetails}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-blue-900 mt-0.5">
                              ✓ Disponible en {space.name} (Soltar para reasignar)
                            </span>
                          )}
                        </div>
                      )}

                      {/* FLOATING EVENT CARDS (Pastel blocks with full collision prevention) */}
                      {spaceBookings.map((res, bookingIndex) => {
                        const box = geometry.get(res.id)!;
                        if (!box.valid || (!intersectsViewport(box.top, box.height, viewport.start, viewport.end)
                          && draggedReservation?.id !== res.id && focusedReservationId !== res.id)) return null;
                        const { s: startMin, e: endMin } = getBookingInterval(res);

                        const clampStart = Math.max(startMin, START_MINUTES);
                        const clampEnd = Math.min(endMin, START_MINUTES + TOTAL_MINUTES);

                        if (clampEnd <= clampStart) return null;

                        const topPosition = ((clampStart - START_MINUTES) / 60) * HOUR_HEIGHT;
                        const cardHeight = Math.max(38, ((clampEnd - clampStart) / 60) * HOUR_HEIGHT);

                        const isConflict = conflictIdsToday.has(res.id);
                        const isBeingDragged = draggedReservation?.id === res.id;

                        const layout = layoutMap.get(res.id) || { colIndex: 0, totalCols: 1 };
                        const isOverlapping = layout.totalCols > 1;

                        // Precise geometric positioning preventing visual occlusion
                        const colWidthPercent = 100 / layout.totalCols;
                        const cardLeftStyle = isOverlapping
                          ? `calc(${layout.colIndex * colWidthPercent}% + 2px)`
                          : '4px';
                        const cardWidthStyle = isOverlapping
                          ? `calc(${colWidthPercent}% - 4px)`
                          : 'calc(100% - 8px)';

                        const styling = getCardStyle(res, isConflict);

                        // Dynamic text and spacing adaptation tiers based on card height & width
                        const isVeryShort = cardHeight < 48;
                        const isShort = cardHeight >= 48 && cardHeight < 72;
                        const isMedium = cardHeight >= 72 && cardHeight < 115;
                        const isTall = cardHeight >= 115;

                        // Adaptive padding class: ensures breathing room around left accent strip
                        const paddingClass = isVeryShort
                          ? 'py-0.5 pl-3 pr-1.5'
                          : isShort
                          ? 'py-1 pl-3.5 pr-2'
                          : isMedium
                          ? 'py-1.5 pl-3.5 pr-2'
                          : 'py-2 pl-4 pr-2.5';

                        // Adaptive typography classes (clean Sentence Case instead of ALL CAPS)
                        const titleClass = isVeryShort
                          ? 'text-[9px] font-semibold text-slate-800 leading-tight truncate'
                          : isShort
                          ? isOverlapping
                            ? 'text-[9px] font-semibold text-slate-800 leading-tight truncate'
                            : 'text-[9.5px] font-semibold text-slate-800 leading-tight truncate'
                          : isMedium
                          ? 'text-[10px] font-semibold text-slate-800 leading-tight truncate'
                          : 'text-[11px] font-semibold text-slate-800 leading-snug truncate';

                        const descClass = isVeryShort
                          ? 'text-[8px] font-normal text-slate-500 leading-none truncate'
                          : isShort
                          ? 'text-[8.5px] font-normal text-slate-500 leading-tight line-clamp-1 break-words'
                          : isMedium
                          ? 'text-[9px] font-normal text-slate-500 leading-tight line-clamp-1 break-words'
                          : 'text-[9.5px] font-normal text-slate-500 leading-snug line-clamp-2 break-words';

                        return (
                          <div
                            key={res.id}
                            data-reservation-id={res.id}
                            ref={node => {
                              if (node && pendingFocus.current === res.id) {
                                pendingFocus.current = null;
                                node.focus({ preventScroll: true });
                              }
                            }}
                            onFocus={() => setFocusedReservationId(res.id)}
                            onBlur={() => setFocusedReservationId(current => current === res.id ? null : current)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Reserva de ${res.tipoActividad}, ${res.horaInicio} a ${res.horaFin}, responsable ${res.responsable}. Presiona Enter o Espacio para ver detalles.`}
                            draggable
                            onDragStart={(e) => handleReservationDragStart(e, res)}
                            onDragEnd={handleReservationDragEnd}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectReservation(res);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab') {
                                const next = spaceBookings[bookingIndex + (e.shiftKey ? -1 : 1)];
                                if (next) {
                                  e.preventDefault();
                                  pendingFocus.current = next.id;
                                  setFocusedReservationId(next.id);
                                  scrollContainerRef.current?.scrollTo({ top: Math.max(0, geometry.get(next.id)!.top - 10) });
                                }
                              }
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelectReservation(res);
                              }
                            }}
                            style={{
                              top: `${topPosition + 2}px`,
                              height: `${cardHeight - 4}px`,
                              left: cardLeftStyle,
                              width: cardWidthStyle
                            }}
                            className={`absolute rounded-xl ${paddingClass} ${styling.bg} border ${styling.border} ${styling.shadow} cursor-grab active:cursor-grabbing hover:scale-[1.01] hover:shadow-md hover:border-slate-300 hover:z-30 transition-all flex flex-col justify-between overflow-hidden select-none z-10 group/card focus:ring-2 focus:ring-blue-500 focus:outline-none focus:z-40 ${
                              isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-blue-500' : ''
                            } ${isOverlapping ? 'ring-1 ring-rose-400/50' : ''}`}
                            title={`${isConflict || isOverlapping ? '⚠️ ¡TOPAMIENTO / RESERVAS PARALELAS!\n' : ''}${res.horaInicio} - ${res.horaFin}\nTipo: ${res.tipoActividad}${res.descripcion ? `\nDescripción: ${res.descripcion}` : ''}\n\n👉 ¡Arrastra esta tarjeta a cualquier espacio u horario para moverla!\n(Haz clic para ver detalles)`}
                          >
                            {/* Left Accent Strip (3.5px rounded vertical bar) */}
                            <span
                              className="absolute left-1 top-1.5 bottom-1.5 w-1 rounded-full shrink-0 transition-opacity"
                              style={{ backgroundColor: styling.accent }}
                            />

                            {/* Main Content Area */}
                            <div className="flex-1 min-h-0 flex flex-col justify-start overflow-hidden">
                              {/* Header row: Grip, Badges & Quick Action Icons */}
                              <div className="flex items-center justify-between min-h-[12px] mb-0.5">
                                <div className="flex items-center space-x-1 min-w-0">
                                  <GripVertical className="w-2.5 h-2.5 text-slate-400 shrink-0 opacity-40 group-hover/card:opacity-100 transition" />
                                  {isConflict && (
                                    <span title="Topamiento de horario" className="text-[8px] bg-rose-600 text-white px-1 py-0.2 rounded font-bold uppercase tracking-tight shrink-0">
                                      ⚠️ TOP
                                    </span>
                                  )}
                                  {res.solicitudEliminacion && (
                                    <span title="Solicitud de eliminación en espera de autorización" className="text-[8px] bg-amber-500 text-white px-1 py-0.2 rounded font-bold uppercase tracking-tight shrink-0 flex items-center gap-0.5">
                                      <span>⏳</span>
                                      <span>ESPERA</span>
                                    </span>
                                  )}
                                  {res.importante === 'Sí' && (
                                    <Flame className="w-2.5 h-2.5 text-amber-600 shrink-0 ml-0.5" />
                                  )}
                                </div>
                                
                                {/* Quick edit/duplicate/delete icons on hover */}
                                <div className="hidden group-hover/card:flex items-center space-x-0.5 ml-1 shrink-0">
                                  {onDuplicateReservation && (
                                    <button
                                      type="button"
                                      title="Duplicar reserva"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDuplicateReservation(res);
                                      }}
                                      className="p-0.5 rounded hover:bg-indigo-600 hover:text-white text-indigo-600 transition"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                  {onEditReservation && (
                                    <button
                                      type="button"
                                      title="Editar reserva"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditReservation(res);
                                      }}
                                      className="p-0.5 rounded hover:bg-slate-900/10 text-slate-700 transition"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                  {(onRequestDelete || onDeleteReservation) && (
                                    <button
                                      type="button"
                                      aria-label="Eliminar reserva"
                                      title={res.actividadRecurrente === 'Sí' || res.recurrenteId || res.serieRecurrente ? "Eliminar reserva (abrir opciones de serie)" : "Eliminar reserva"}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (res.actividadRecurrente === 'Sí' || res.recurrenteId || res.serieRecurrente) {
                                          // For recurring events, open the detail modal with full confirmation
                                          // so user can select whether to delete single session or the whole series
                                          onSelectReservation(res);
                                        } else if (onRequestDelete) {
                                          onRequestDelete(res);
                                        } else if (onDeleteReservation) {
                                          onDeleteReservation(res.id, false);
                                        }
                                      }}
                                      className="p-0.5 rounded hover:bg-rose-600 hover:text-white text-rose-600 transition"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Very short layout (single condensed block) */}
                              {isVeryShort ? (
                                <div className="flex flex-col justify-center overflow-hidden">
                                  <div className={titleClass}>
                                    {res.tipoActividad}
                                  </div>
                                  {res.descripcion && (
                                    <div className={descClass}>
                                      {res.descripcion}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex-1 min-h-0 flex flex-col justify-start space-y-0.5 overflow-hidden">
                                  {/* Line 1: Activity / Reservation Type */}
                                  <div className={titleClass}>
                                    {res.tipoActividad}
                                  </div>

                                  {/* Line 2: Activity Description */}
                                  {res.descripcion && (
                                    <div className={descClass}>
                                      {res.descripcion}
                                    </div>
                                  )}

                                  {/* Line 3: Time slot & Responsible (for medium/tall cards) */}
                                  {(isMedium || isTall) && (
                                    <div className="mt-auto pt-1 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                                      <span>{res.horaInicio} – {res.horaFin}</span>
                                      {isTall && res.responsable && (
                                        <span className="truncate max-w-[80px] font-sans text-slate-500 font-normal">{res.responsable}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Legend & Quick Summary (Ultra-compact footer with soft dots) */}
        <div className="py-1.5 px-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-slate-500 leading-tight">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <span className="font-semibold text-slate-600 text-[10.5px]">Categorías:</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10.5px] font-medium text-slate-600">Taller Municipal</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10.5px] font-medium text-slate-600">Taller JJV</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10.5px] font-medium text-slate-600">Taller CCD / Deportes</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              <span className="text-[10.5px] font-medium text-slate-600">Préstamo / CAM</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-[10.5px] font-medium text-slate-600">Ensayo / Danza</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-slate-400 font-mono text-[10.5px]">
            <span>Total: <strong className="text-slate-700">{dayReservations.length}</strong> {dayReservations.length === 1 ? 'actividad' : 'actividades'} en <strong className="text-slate-700">{activeSpaces.length}</strong> {activeSpaces.length === 1 ? 'espacio' : 'espacios'}</span>
          </div>
        </div>
      </div>

      {/* Print PDF Schedule Modal - Lazy Loaded with Suspense */}
      {isPrintModalOpen && (
        <Suspense fallback={null}>
          <PrintScheduleModal
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            reservations={reservations}
            spaces={spaces}
            initialDate={dateStr}
          />
        </Suspense>
      )}
    </div>
  );
};

