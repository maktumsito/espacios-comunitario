import React from 'react';
import { Sparkles } from 'lucide-react';

interface WizardStepsBarProps {
  wizardStep: 1 | 2 | 3;
  isStep1Completed: boolean;
  isStep2Completed: boolean;
  isStep3Completed: boolean;
  espacio?: string;
  responsable?: string;
  descripcion?: string;
  onSelectStep: (step: 1 | 2 | 3) => void;
}

export const WizardStepsBar: React.FC<WizardStepsBarProps> = React.memo(({
  wizardStep,
  isStep1Completed,
  isStep2Completed,
  isStep3Completed,
  espacio,
  responsable,
  descripcion,
  onSelectStep
}) => {
  return (
    <div id="reservation-wizard-stepper" className="bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-200 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {/* Step 1 */}
        <button
          type="button"
          id="wizard-step-tab-1"
          onClick={() => onSelectStep(1)}
          className={`flex items-center space-x-2 p-2 sm:p-2.5 rounded-xl border text-left transition cursor-pointer ${
            wizardStep === 1
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
              : isStep1Completed
              ? 'bg-white border-emerald-300 text-slate-800 hover:bg-emerald-50/50'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
            wizardStep === 1
              ? 'bg-white/20 text-white'
              : isStep1Completed
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {isStep1Completed && wizardStep !== 1 ? '✓' : '1'}
          </div>
          <div className="min-w-0 flex-1 hidden sm:block">
            <span className={`text-[11px] font-bold block truncate ${wizardStep === 1 ? 'text-white' : 'text-slate-800'}`}>
              1. ¿Dónde y Cuándo?
            </span>
            <span className={`text-[10px] block truncate ${wizardStep === 1 ? 'text-blue-100' : 'text-slate-500'}`}>
              {espacio || 'Espacio y horario'}
            </span>
          </div>
          <span className="sm:hidden text-xs font-bold truncate">1. Espacio</span>
        </button>

        {/* Step 2 */}
        <button
          type="button"
          id="wizard-step-tab-2"
          onClick={() => onSelectStep(2)}
          className={`flex items-center space-x-2 p-2 sm:p-2.5 rounded-xl border text-left transition cursor-pointer ${
            wizardStep === 2
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
              : isStep2Completed
              ? 'bg-white border-emerald-300 text-slate-800 hover:bg-emerald-50/50'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
            wizardStep === 2
              ? 'bg-white/20 text-white'
              : isStep2Completed
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {isStep2Completed && wizardStep !== 2 ? '✓' : '2'}
          </div>
          <div className="min-w-0 flex-1 hidden sm:block">
            <span className={`text-[11px] font-bold block truncate ${wizardStep === 2 ? 'text-white' : 'text-slate-800'}`}>
              2. ¿Quién lo solicita?
            </span>
            <span className={`text-[10px] block truncate ${wizardStep === 2 ? 'text-blue-100' : 'text-slate-500'}`}>
              {responsable || 'Datos solicitante'}
            </span>
          </div>
          <span className="sm:hidden text-xs font-bold truncate">2. Solicitante</span>
        </button>

        {/* Step 3 */}
        <button
          type="button"
          id="wizard-step-tab-3"
          onClick={() => onSelectStep(3)}
          className={`flex items-center space-x-2 p-2 sm:p-2.5 rounded-xl border text-left transition cursor-pointer ${
            wizardStep === 3
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
              : isStep3Completed
              ? 'bg-white border-emerald-300 text-slate-800 hover:bg-emerald-50/50'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${
            wizardStep === 3
              ? 'bg-white/20 text-white'
              : isStep3Completed
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {isStep3Completed && wizardStep !== 3 ? '✓' : '3'}
          </div>
          <div className="min-w-0 flex-1 hidden sm:block">
            <span className={`text-[11px] font-bold block truncate ${wizardStep === 3 ? 'text-white' : 'text-slate-800'}`}>
              3. Detalles & Recursos
            </span>
            <span className={`text-[10px] block truncate ${wizardStep === 3 ? 'text-blue-100' : 'text-slate-500'}`}>
              {descripcion || 'Actividad y equipos'}
            </span>
          </div>
          <span className="sm:hidden text-xs font-bold truncate">3. Detalles</span>
        </button>
      </div>
    </div>
  );
});
