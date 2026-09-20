import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Reservation, SpaceInfo, isSingleDayMultiSpaceReservation, SpaceBlock } from '../types';
import { SPACES_LIST } from '../data/spacesData';
import { getChileanHolidayInfo, ChileanHoliday } from '../utils/holidayUtils';
import { useReservationDateIndex } from '../utils/reservationIndex';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Flame,
  ArrowRight,
  Sparkles,
  Hammer
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns';
import { es } from 'date-fns/locale';

// ============================================================================
// COLOR CODING & LEGEND DATA
// ============================================================================
export const COLOR_LEGEND_ITEMS = [
  { label: 'Taller Municipal', color: '#2563eb', bg: 'bg-[#dbeafe]', border: 'border-[#bfdbfe]', text: 'text-blue-900' },
  { label: 'Taller JJV / Vecinal', color: '#d97706', bg: 'bg-[#fef3c7]', border: 'border-[#fde047]', text: 'text-amber-900' },
  { label: 'Taller CCD / Deportes', color: '#059669', bg: 'bg-[#dcfce7]', border: 'border-[#bbf7d0]', text: 'text-emerald-900' },
  { label: 'Préstamo / CAM', color: '#0d9488', bg: 'bg-[#d1fae5]', border: 'border-[#a7f3d0]', text: 'text-teal-900' },
  { label: 'Ensayos / Danza / Cumpleaños', color: '#ea580c', bg: 'bg-[#ffedd5]', border: 'border-[#fed7aa]', text: 'text-orange-900' },
  { label: 'Otras Actividades', color: '#7c3aed', bg: 'bg-[#ede9fe]', border: 'border-[#ddd6fe]', text: 'text-purple-900' },
  { label: 'Topamiento / Conflicto', color: '#e11d48', bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-950' }
];

export const ColorLegendBar: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-1.5 sm:p-2 shadow-2xs">
      <div className="flex items-center justify-between flex-wrap gap-1.5 text-xs">
        <div className="flex items-center space-x-1.5 text-slate-500 font-bold shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Código de Colores:</span>
        </div>
        <div className="flex items-center flex-wrap gap-1.5">
          {COLOR_LEGEND_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[10.5px] font-semibold ${item.bg} ${item.border} ${item.text}`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MEMOIZED CHILD COMPONENTS
// ============================================================================

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

/**
 * Top navigation bar with month selector and quick 'Today' jump button.
 */
const CalendarHeader = memo<CalendarHeaderProps>(({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 sm:px-4 py-2 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2">
      <div className="flex items-center space-x-2.5">
        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
          <CalendarIcon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 capitalize leading-tight">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <p className="text-[11px] text-slate-500">
            Haz clic en cualquier día para ver el resumen o entrar al Horario Diario detallado
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          id="btn-cal-prev-month"
          aria-label="Mes anterior"
          onClick={onPrevMonth}
          className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          title="Mes anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="btn-cal-today"
          aria-label="Ir a la fecha de hoy"
          onClick={onToday}
          className="px-3 py-1 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
        >
          Hoy
        </button>

        <button
          type="button"
          id="btn-cal-next-month"
          aria-label="Mes siguiente"
          onClick={onNextMonth}
          className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          title="Mes siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
CalendarHeader.displayName = 'CalendarHeader';

/**
 * Weekday columns header (Lun, Mar, Mié, Jue, Vie, Sáb, Dom).
 */
const CalendarWeekDaysHeader = memo(() => {
  return (
    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90 text-center text-xs font-bold text-slate-600 py-2">
      <div>Lun</div>
      <div>Mar</div>
      <div>Mié</div>
      <div>Jue</div>
      <div>Vie</div>
      <div className="text-blue-600">Sáb</div>
      <div className="text-blue-600">Dom</div>
    </div>
  );
});
CalendarWeekDaysHeader.displayName = 'CalendarWeekDaysHeader';

interface CalendarEventTagProps {
  reservation: Reservation;
  color: string;
  onSelectReservation: (reserva: Reservation) => void;
}

/**
 * Individual compact activity pill inside a calendar grid cell with hover tooltip.
 */
const CalendarEventTag = memo<CalendarEventTagProps>(({
  reservation,
  color,
  onSelectReservation
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isCancelled = reservation.estado === 'cancelada';

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectReservation(reservation);
  }, [onSelectReservation, reservation]);

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={`Actividad: ${reservation.descripcion || reservation.tipoActividad} a las ${reservation.horaInicio} en ${reservation.espacio}`}
      className={`w-full text-left relative text-[10px] px-1.5 py-0.5 rounded truncate font-medium text-white flex items-center space-x-1 shadow-xs transition hover:opacity-90 hover:scale-[1.02] cursor-pointer border-0 ${
        isCancelled ? 'opacity-50 line-through grayscale-[50%]' : ''
      }`}
      style={{ backgroundColor: isCancelled ? '#64748b' : color }}
    >
      <span className="font-mono text-[9px] opacity-90 shrink-0">{reservation.horaInicio}</span>
      {isCancelled && (
        <span className="shrink-0 text-[9px] font-bold text-rose-200" title="Reserva Cancelada">🚫</span>
      )}
      {reservation.solicitudEliminacion && !isCancelled && (
        <span className="shrink-0 text-[9px]" title="Solicitud de eliminación en espera">⏳</span>
      )}
      <span className="truncate">{reservation.descripcion || reservation.tipoActividad}</span>

      {/* Floating Detailed Hover Tooltip */}
      {showTooltip && (
        <div className="fixed z-50 pointer-events-none bg-slate-900 text-white rounded-xl p-3 shadow-2xl border border-slate-700 text-xs w-64 space-y-1.5 animate-fadeIn -translate-y-full -translate-x-4 mt-[-8px]">
          {isCancelled && (
            <div className="text-[10px] text-rose-300 font-bold bg-rose-950/80 px-2 py-1 rounded border border-rose-500/50">
              🚫 Reserva Cancelada (Horario liberado para disponibilidad)
            </div>
          )}
          {reservation.solicitudEliminacion && !isCancelled && (
            <div className="text-[10px] text-amber-300 font-bold bg-amber-950/80 px-2 py-1 rounded border border-amber-500/50">
              ⏳ Solicitud de eliminación en espera de autorización
            </div>
          )}
          <div className="font-bold text-sm text-white leading-tight">
            {reservation.descripcion || reservation.tipoActividad}
          </div>
          <div className="text-[11px] text-blue-300 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>{reservation.horaInicio} - {reservation.horaFin}</span>
          </div>
          <div className="text-[11px] text-slate-300 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span>{reservation.espacio}</span>
          </div>
          {reservation.responsable && (
            <div className="text-[11px] text-slate-300 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              <span>{reservation.responsable}</span>
            </div>
          )}
          {reservation.tipoActividad && (
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
              Tipo: <span className="text-slate-200 font-semibold">{reservation.tipoActividad}</span>
            </div>
          )}
        </div>
      )}
    </button>
  );

});
CalendarEventTag.displayName = 'CalendarEventTag';

interface CalendarDayCellProps {
  day: Date;
  dateStr: string;
  dayReservations: Reservation[];
  dayBlocks?: SpaceBlock[];
  isSelected: boolean;
  isCurrentMonth: boolean;
  isDayToday: boolean;
  holidayInfo: ChileanHoliday | null;
  onSelectDay: (day: Date) => void;
  onNavigateToDay?: (day: Date) => void;
  onSelectReservation: (reserva: Reservation) => void;
  getSpaceColor: (spaceName: string) => string;
}

/**
 * Individual Day Cell inside the monthly calendar grid.
 */
const CalendarDayCell = memo<CalendarDayCellProps>(({
  day,
  dayReservations,
  dayBlocks = [],
  isSelected,
  isCurrentMonth,
  isDayToday,
  holidayInfo,
  onSelectDay,
  onNavigateToDay,
  onSelectReservation,
  getSpaceColor
}) => {
  const handleCellClick = useCallback(() => {
    onSelectDay(day);
  }, [onSelectDay, day]);

  const handleDoubleClick = useCallback(() => {
    if (onNavigateToDay) {
      onNavigateToDay(day);
    }
  }, [onNavigateToDay, day]);

  return (
    <div
      onClick={handleCellClick}
      onDoubleClick={handleDoubleClick}
      className={`min-h-[80px] sm:min-h-[90px] lg:min-h-[100px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between group hover:bg-blue-50/30 ${
        holidayInfo
          ? 'bg-rose-50/40 border-t border-rose-200'
          : !isCurrentMonth
          ? 'opacity-40 bg-slate-50/40'
          : 'bg-white'
      } ${isSelected ? 'ring-2 ring-blue-600 bg-blue-50/40 z-10' : ''}`}
      title="Clic para seleccionar agenda • Doble clic para abrir en Uso Diario"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <span
            className={`text-xs font-semibold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${
              isDayToday
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : isSelected
                ? 'bg-blue-100 text-blue-700 font-bold'
                : holidayInfo
                ? 'bg-rose-100 text-rose-800 font-bold'
                : 'text-slate-700'
            }`}
          >
            {format(day, 'd')}
          </span>
          {holidayInfo && (
            <span
              className="text-[9px] font-bold text-rose-700 bg-rose-100/90 px-1 py-0.2 rounded leading-tight truncate max-w-[65px]"
              title={`Feriado en Chile: ${holidayInfo.name}`}
            >
              🇨🇱 {holidayInfo.name.split(' ')[0]}
            </span>
          )}
        </div>

        {dayReservations.length > 0 && (
          <span className="text-[9.5px] px-1 py-0.2 rounded font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {dayReservations.length} {dayReservations.length === 1 ? 'act.' : 'acts.'}
          </span>
        )}
      </div>

      {/* Event Tags inside cell: Maximum 2 lines for clean, unbloated view */}
      <div className="mt-1 space-y-1 flex-1 overflow-hidden animate-in fade-in duration-200">
        {dayBlocks.slice(0, 1).map((block) => (
          <div
            key={block.id}
            className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold flex items-center space-x-1 shadow-2xs truncate"
            title={`Bloqueado por ${block.motivo}: ${block.espacio} (${block.todoElDia ? 'Todo el día' : `${block.horaInicio} - ${block.horaFin}`})`}
          >
            <Hammer className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{block.espacio}</span>
          </div>
        ))}
        {dayReservations.slice(0, Math.max(0, 2 - dayBlocks.slice(0, 1).length)).map((res) => {
          const color = getSpaceColor(res.espacio);
          return (
            <CalendarEventTag
              key={res.id}
              reservation={res}
              color={color}
              onSelectReservation={onSelectReservation}
            />
          );
        })}
        {dayReservations.length > Math.max(0, 2 - dayBlocks.slice(0, 1).length) && (
          <div className="text-[9px] font-bold text-blue-700 bg-blue-50/90 border border-blue-200/80 px-1.5 py-0.2 rounded text-center truncate">
            +{dayReservations.length - Math.max(0, 2 - dayBlocks.slice(0, 1).length)} más
          </div>
        )}
      </div>
    </div>
  );
});
CalendarDayCell.displayName = 'CalendarDayCell';

interface AgendaReservationCardProps {
  reservation: Reservation;
  spaceColor: string;
  onSelectReservation: (reserva: Reservation) => void;
}

/**
 * Detailed card for an activity in the bottom day agenda list.
 */
const AgendaReservationCard = memo<AgendaReservationCardProps>(({
  reservation,
  spaceColor,
  onSelectReservation
}) => {
  const handleClick = useCallback(() => {
    onSelectReservation(reservation);
  }, [onSelectReservation, reservation]);

  const isImportant = reservation.importante === 'Sí';
  const isCancelled = reservation.estado === 'cancelada';

  return (
    <div
      onClick={handleClick}
      className={`bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3 space-y-2 transition-all shadow-xs cursor-pointer relative overflow-hidden group ${
        isCancelled ? 'opacity-60 bg-slate-100/80' : ''
      }`}
    >
      <div
        className="absolute top-0 left-0 bottom-0 w-1.5"
        style={{ backgroundColor: isCancelled ? '#94a3b8' : spaceColor }}
      />

      {/* Top line: Time & Badge */}
      <div className="flex items-center justify-between pl-1">
        <div className={`flex items-center space-x-1 text-xs font-mono font-bold ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
          <Clock className="w-3 h-3 text-blue-600" />
          <span>{reservation.horaInicio} - {reservation.horaFin}</span>
        </div>

        <div className="flex items-center space-x-1">
          {isCancelled && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5">
              <span>🚫</span>
              <span>Cancelada</span>
            </span>
          )}
          {isImportant && !isCancelled && (
            <span className="p-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200" title="Actividad Importante">
              <Flame className="w-2.5 h-2.5 text-amber-500" />
            </span>
          )}
          {isSingleDayMultiSpaceReservation(reservation) ? (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
              Multi-Espacio
            </span>
          ) : reservation.actividadRecurrente === 'Sí' ? (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
              Recurrente
            </span>
          ) : null}
          {reservation.solicitudEliminacion && !isCancelled && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5"
              title="Solicitud de eliminación en espera de autorización"
            >
              <span>⏳</span>
              <span>En espera</span>
            </span>
          )}
        </div>
      </div>

      {/* Activity Name */}
      <div className="pl-1">
        <h4 className={`text-xs font-bold transition truncate ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-900 group-hover:text-blue-700'}`}>
          {reservation.descripcion || reservation.tipoActividad}
        </h4>
      </div>

      {/* Space & Responsible */}
      <div className="pl-1 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center space-x-1 truncate font-medium text-slate-800 max-w-[120px]">
          <MapPin className="w-3 h-3 shrink-0" style={{ color: spaceColor }} />
          <span className="truncate">{reservation.espacio}</span>
        </div>
        <div className="flex items-center space-x-1 text-slate-500 truncate max-w-[100px]">
          <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
          <span className="truncate">{reservation.responsable}</span>
        </div>
      </div>
    </div>
  );
});
AgendaReservationCard.displayName = 'AgendaReservationCard';

interface SelectedDayAgendaProps {
  selectedDay: Date;
  selectedDayStr: string;
  selectedDayReservations: Reservation[];
  holidayInfo: ChileanHoliday | null;
  getSpaceColor: (spaceName: string) => string;
  onSelectReservation: (reserva: Reservation) => void;
  onNewReservationForDate: (dateStr: string) => void;
  onNavigateToDay?: (day: Date) => void;
}

/**
 * Bottom agenda list for the selected day with direct action to open in Daily Usage view.
 */
const SelectedDayAgenda = memo<SelectedDayAgendaProps>(({
  selectedDay,
  selectedDayStr,
  selectedDayReservations,
  holidayInfo,
  getSpaceColor,
  onSelectReservation,
  onNewReservationForDate,
  onNavigateToDay
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const handleAddNew = useCallback(() => {
    onNewReservationForDate(selectedDayStr);
  }, [onNewReservationForDate, selectedDayStr]);

  const handleOpenDailyUsage = useCallback(() => {
    if (onNavigateToDay) {
      onNavigateToDay(selectedDay);
    }
  }, [onNavigateToDay, selectedDay]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-xs space-y-2.5">
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${isExpanded ? 'pb-2.5 border-b border-slate-200' : ''}`}>
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 capitalize flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Programación del {format(selectedDay, "EEEE, dd 'de' MMMM yyyy", { locale: es })}</span>
            </h3>
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
              {selectedDayReservations.length} {selectedDayReservations.length === 1 ? 'actividad' : 'actividades'}
            </span>
            {holidayInfo && (
              <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200 flex items-center space-x-1">
                <span>🇨🇱</span>
                <span>Feriado: {holidayInfo.name}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-1.5">
          {selectedDayReservations.length > 0 && (
            <button
              type="button"
              id="btn-cal-toggle-agenda"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <span>{isExpanded ? 'Ocultar Detalle' : `Ver Detalle (${selectedDayReservations.length})`}</span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '-rotate-90' : 'rotate-90'}`} />
            </button>
          )}

          {onNavigateToDay && (
            <button
              type="button"
              id="btn-cal-go-daily-usage"
              onClick={handleOpenDailyUsage}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              title="Abrir vista de cuadrícula horaria completa para este día"
            >
              <span>Ver en Horario Diario</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            id="btn-cal-add-for-day"
            onClick={handleAddNew}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
          >
            + Reservar este día
          </button>
        </div>
      </div>

      {isExpanded && (
        selectedDayReservations.length === 0 ? (
          <div className="py-4 text-center text-slate-500 space-y-1.5">
            <Clock className="w-5 h-5 mx-auto text-slate-400" />
            <p className="text-xs font-medium">No hay actividades programadas para este día.</p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleAddNew}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
              >
                + Crear una nueva reserva
              </button>
              {onNavigateToDay && (
                <>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleOpenDailyUsage}
                    className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    Ver cuadrícula en Horario Diario
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {selectedDayReservations.map((res) => (
              <AgendaReservationCard
                key={res.id}
                reservation={res}
                spaceColor={getSpaceColor(res.espacio)}
                onSelectReservation={onSelectReservation}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
});
SelectedDayAgenda.displayName = 'SelectedDayAgenda';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface CalendarViewProps {
  reservations: Reservation[];
  spaces?: SpaceInfo[];
  selectedDate?: Date;
  spaceBlocks?: SpaceBlock[];
  onNavigateToDay?: (day: Date) => void;
  onSelectReservation: (reserva: Reservation) => void;
  onNewReservationForDate: (dateStr: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  reservations,
  spaces = SPACES_LIST,
  selectedDate: propSelectedDate,
  spaceBlocks = [],
  onNavigateToDay,
  onSelectReservation,
  onNewReservationForDate
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(() => propSelectedDate || new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => propSelectedDate || new Date());

  // Keep internal calendar state synchronized with incoming date changes
  useEffect(() => {
    if (propSelectedDate) {
      setCurrentDate(propSelectedDate);
      setSelectedDay(propSelectedDate);
    }
  }, [propSelectedDate]);

  // Fast space color lookup map
  const spaceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    spaces.forEach((s) => map.set(s.name.toUpperCase(), s.color));
    return map;
  }, [spaces]);

  const getSpaceColor = useCallback((spaceName: string): string => {
    if (!spaceName) return '#64748b';
    return spaceColorMap.get(spaceName.trim().toUpperCase()) || '#64748b';
  }, [spaceColorMap]);

  // Calendar day calculation memoized
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Standardized in-memory hash map index grouping reservations by date in O(N)
  const reservationIndex = useReservationDateIndex(reservations);

  // Memoized month days grid data to eliminate recalculating dates and filters on every re-render
  const calendarDaysData = useMemo(() => {
    const selectedDayIso = format(selectedDay, 'yyyy-MM-dd');
    const todayIso = format(new Date(), 'yyyy-MM-dd');

    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayReservations = reservationIndex.get(dateStr) || [];
      const isSelected = dateStr === selectedDayIso;
      const isCurrentMonth = isSameMonth(day, currentDate);
      const isDayToday = dateStr === todayIso;
      const holidayInfo = getChileanHolidayInfo(dateStr);
      const dayBlocks = spaceBlocks.filter(
        (b) => b.activo && dateStr >= b.fechaInicio && dateStr <= b.fechaFin
      );

      return {
        day,
        dateStr,
        dayReservations,
        dayBlocks,
        isSelected,
        isCurrentMonth,
        isDayToday,
        holidayInfo
      };
    });
  }, [days, currentDate, selectedDay, reservationIndex, spaceBlocks]);

  const selectedDayStr = useMemo(() => format(selectedDay, 'yyyy-MM-dd'), [selectedDay]);

  const selectedDayReservations = useMemo(() => {
    return reservationIndex.get(selectedDayStr) || [];
  }, [reservationIndex, selectedDayStr]);

  const selectedDayHolidayInfo = useMemo(() => {
    return getChileanHolidayInfo(selectedDayStr);
  }, [selectedDayStr]);

  // Stable navigation callbacks
  const handlePrevMonth = useCallback(() => {
    setCurrentDate((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate((prev) => addMonths(prev, 1));
  }, []);

  const handleToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now);
  }, []);

  const handleSelectDay = useCallback((day: Date) => {
    setSelectedDay(day);
  }, []);

  return (
    <div className="w-full h-full mx-auto p-0.5 sm:p-1.5 space-y-2 flex flex-col flex-1">
      {/* Calendar Header Navigation */}
      <CalendarHeader
        currentDate={currentDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />

      {/* Color Legend Bar */}
      <ColorLegendBar />

      {/* Month Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <CalendarWeekDaysHeader />

        <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-200">
          {calendarDaysData.map((dayData) => (
            <CalendarDayCell
              key={dayData.dateStr}
              day={dayData.day}
              dateStr={dayData.dateStr}
              dayReservations={dayData.dayReservations}
              dayBlocks={dayData.dayBlocks}
              isSelected={dayData.isSelected}
              isCurrentMonth={dayData.isCurrentMonth}
              isDayToday={dayData.isDayToday}
              holidayInfo={dayData.holidayInfo}
              onSelectDay={handleSelectDay}
              onNavigateToDay={onNavigateToDay}
              onSelectReservation={onSelectReservation}
              getSpaceColor={getSpaceColor}
            />
          ))}
        </div>
      </div>

      {/* Selected Day Agenda View */}
      <SelectedDayAgenda
        selectedDay={selectedDay}
        selectedDayStr={selectedDayStr}
        selectedDayReservations={selectedDayReservations}
        holidayInfo={selectedDayHolidayInfo}
        getSpaceColor={getSpaceColor}
        onSelectReservation={onSelectReservation}
        onNewReservationForDate={onNewReservationForDate}
        onNavigateToDay={onNavigateToDay}
      />
    </div>
  );
};
