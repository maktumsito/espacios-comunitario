import React, { useState, useMemo } from 'react';
import { Reservation, SpaceInfo } from '../types';
import {
  generateConflictRecommendations,
  ConflictRecommendation,
  RecommendationType
} from '../utils/conflictRecommender';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import {
  Sparkles,
  Clock,
  MapPin,
  Calendar,
  ArrowRight,
  Check,
  Zap,
  ChevronRight,
  ChevronUp
} from 'lucide-react';

interface ConflictRecommendationPanelProps {
  currentSlot: {
    fecha?: string;
    horaInicio?: string;
    horaFin?: string;
    espacio?: string;
    cantidadParticipantes?: number;
  };
  allReservations: readonly Reservation[];
  excludeReservationId?: string;
  onApplyRecommendation: (recommendation: ConflictRecommendation) => void;
  customSpacesList?: SpaceInfo[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
  defaultOpen?: boolean;
}

export const ConflictRecommendationPanel: React.FC<ConflictRecommendationPanelProps> = ({
  currentSlot,
  allReservations,
  excludeReservationId,
  onApplyRecommendation,
  customSpacesList,
  title = 'Recomendaciones Inteligentes para Resolver el Topamiento',
  subtitle = 'El sistema analizó la disponibilidad y calculó las mejores alternativas para evitar el copamiento:',
  compact = false,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedFilter, setSelectedFilter] = useState<'all' | RecommendationType>('all');
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const summary = useMemo(() => {
    return generateConflictRecommendations(
      currentSlot,
      allReservations,
      excludeReservationId,
      { customSpacesList }
    );
  }, [currentSlot, allReservations, excludeReservationId, customSpacesList]);

  // Declared unconditionally at the top level to guarantee stable hook order (fixes React Error #300)
  const displayedList = useMemo(() => {
    if (!summary.hasRecommendations) return [];
    if (selectedFilter === 'all') return summary.allRecommendations;
    if (selectedFilter === 'same_space_other_time') return summary.sameSpaceOtherTimes;
    if (selectedFilter === 'other_space_same_time') return summary.otherSpacesSameTime;
    if (selectedFilter === 'other_day_same_time') return summary.otherDaysSameTime;
    return summary.allRecommendations;
  }, [selectedFilter, summary]);

  const handleApply = (rec: ConflictRecommendation) => {
    setAppliedId(rec.id);
    onApplyRecommendation(rec);
    setTimeout(() => setAppliedId(null), 2500);
  };

  const getBadgeClasses = (variant: ConflictRecommendation['badgeVariant']) => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'blue':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'indigo':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'purple':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'amber':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  if (!isOpen) {
    return (
      <button
        id="btn-show-conflict-recommendations"
        type="button"
        aria-label="Aviso: Ver recomendaciones inteligentes para resolver el topamiento"
        onClick={() => setIsOpen(true)}
        className="w-full text-left p-2.5 px-3 bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200 hover:border-indigo-300 rounded-xl transition-all shadow-2xs group flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="p-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white rounded-lg shadow-2xs shrink-0 transition">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-indigo-600 text-white shadow-2xs">
                Aviso
              </span>
              <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-950 truncate">
                Recomendaciones inteligentes para resolver topamiento
              </span>
              {summary.hasRecommendations && (
                <span className="text-[10px] bg-indigo-100 text-indigo-950 font-extrabold px-1.5 py-0.2 rounded-full border border-indigo-200 font-mono">
                  {summary.totalCount} {summary.totalCount === 1 ? 'opción' : 'opciones'}
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-600 group-hover:text-slate-800 truncate mt-0.5">
              Hay alternativas calculadas para evitar topamientos de salas y horarios. Clic para verlas.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 text-[11px] font-bold text-indigo-700 bg-white group-hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 shrink-0 ml-2 shadow-2xs transition">
          <span>Ver opciones</span>
          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>
    );
  }

  if (!summary.hasRecommendations) {
    return (
      <div className="p-2.5 px-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center space-x-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-900 font-medium truncate">
            Sin sugerencias inmediatas para este bloque. Prueba con otro espacio o fecha.
          </span>
        </div>
        <button
          id="btn-hide-no-recommendations"
          type="button"
          aria-label="Ocultar aviso de recomendaciones"
          onClick={() => setIsOpen(false)}
          className="text-[10.5px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer shrink-0"
        >
          Ocultar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-slate-50 border border-indigo-200 rounded-xl p-2.5 sm:p-3 space-y-2 shadow-2xs">
      {/* Header - Compact 1-line */}
      <div className="flex items-center justify-between gap-2 border-b border-indigo-100 pb-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="p-1 bg-indigo-600 text-white rounded-lg shadow-2xs shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 truncate">
              <h4 className="text-xs font-bold text-slate-900 truncate">
                {title}
              </h4>
              <span className="text-[10px] bg-indigo-200 text-indigo-950 font-extrabold px-1.5 py-0.2 rounded-full font-mono shrink-0">
                {summary.totalCount} disp.
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex items-center space-x-1 px-2 py-0.5 text-[10.5px] font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-md border border-indigo-200 transition cursor-pointer shadow-2xs shrink-0"
          title="Ocultar recomendaciones"
        >
          <span>Ocultar</span>
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>

      {/* Category Pills Filter - Ultra-compact */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setSelectedFilter('all')}
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs ${
            selectedFilter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Zap className="w-2.5 h-2.5" />
          <span>Todas ({summary.totalCount})</span>
        </button>

        {summary.sameSpaceOtherTimes.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedFilter('same_space_other_time')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs ${
              selectedFilter === 'same_space_other_time'
                ? 'bg-blue-600 text-white'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Clock className="w-2.5 h-2.5" />
            <span>Mismo espacio ({summary.sameSpaceOtherTimes.length})</span>
          </button>
        )}

        {summary.otherSpacesSameTime.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedFilter('other_space_same_time')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs ${
              selectedFilter === 'other_space_same_time'
                ? 'bg-emerald-600 text-white'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <MapPin className="w-2.5 h-2.5" />
            <span>Otra sala ({summary.otherSpacesSameTime.length})</span>
          </button>
        )}

        {summary.otherDaysSameTime.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedFilter('other_day_same_time')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs ${
              selectedFilter === 'other_day_same_time'
                ? 'bg-purple-600 text-white'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Calendar className="w-2.5 h-2.5" />
            <span>Otro día ({summary.otherDaysSameTime.length})</span>
          </button>
        )}
      </div>

      {/* Recommendations Cards - Compact list in small vertical footprint */}
      <div className="space-y-1.5 max-h-44 sm:max-h-48 overflow-y-auto pr-1">
        {displayedList.map((rec, index) => {
          const isTop = index === 0 && selectedFilter === 'all';
          const isJustApplied = appliedId === rec.id;

          return (
            <div
              key={rec.id}
              className={`p-2 rounded-lg border transition flex items-center justify-between gap-2 shadow-2xs ${
                isJustApplied
                  ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400'
                  : isTop
                  ? 'bg-white border-indigo-300 hover:border-indigo-400'
                  : 'bg-white/95 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <div className="shrink-0 p-1 rounded bg-slate-50 border border-slate-100">
                  {rec.type === 'same_space_other_time' && <Clock className="w-3.5 h-3.5 text-blue-600" />}
                  {rec.type === 'other_space_same_time' && <MapPin className="w-3.5 h-3.5 text-emerald-600" />}
                  {rec.type === 'other_day_same_time' && <Calendar className="w-3.5 h-3.5 text-purple-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="font-bold text-slate-900 text-xs truncate">{rec.title}</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase shrink-0 ${getBadgeClasses(rec.badgeVariant)}`}>
                      {rec.badgeText}
                    </span>
                    {isTop && (
                      <span className="text-[9px] bg-indigo-100 text-indigo-900 font-extrabold px-1.5 py-0.2 rounded shrink-0">
                        ⭐ Mejor
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-[10.5px] text-slate-500 truncate">
                    <span className="truncate">{rec.subtitle}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-slate-600 shrink-0">
                      {rec.type === 'other_day_same_time' ? formatDateDDMMYYYY(rec.fecha) : `${rec.horaInicio} - ${rec.horaFin}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleApply(rec)}
                disabled={isJustApplied}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer shrink-0 shadow-2xs ${
                  isJustApplied
                    ? 'bg-emerald-600 text-white'
                    : rec.type === 'same_space_other_time'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : rec.type === 'other_space_same_time'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                title="Aplicar sugerencia"
              >
                {isJustApplied ? (
                  <>
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Aplicado</span>
                  </>
                ) : (
                  <>
                    <span>Aplicar</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
