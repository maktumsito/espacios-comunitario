import React from 'react';
import { User } from 'lucide-react';
import { Reservation } from '../types';
import { ResponsibleHistoryAlert } from '../services/ratingService';
import { ApplicantContactSection } from './ApplicantContactSection';

export interface ReservationStep3ApplicantProps {
  isWizardMode: boolean;
  wizardStep: 1 | 2 | 3 | 4 | 5;
  formData: Partial<Reservation>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Reservation>>>;
  handleResponsableChange: (name: string) => void;
  uniqueResponsablesList: {
    responsable: string;
    rut?: string;
    telefonoContacto?: string;
    emailContacto?: string;
    domicilio?: string;
  }[];
  autoFilledContactNotice: boolean;
  phoneValidation: { isValid: boolean; error?: string };
  rutValidation: { isValid: boolean; error?: string };
  emailValidation: { isValid: boolean; error?: string };
  primarySpaceCapacityWarning: { hasWarning: boolean; recommendedCapacity: number; requestedCount: number };
  secondSpaceCapacityWarning?: { hasWarning: boolean; recommendedCapacity: number; requestedCount: number } | null;
  singleSecondSpace?: string;
  responsibleHistoryAlert: ResponsibleHistoryAlert;
  descargarCartaAlCrear: boolean;
  setDescargarCartaAlCrear: (val: boolean) => void;
  setShowCommitmentLetterModal: (show: boolean) => void;
  editingReservation?: Reservation | null;
  effectiveFormDataForLetter?: any;
  effectiveSeriesSlotsForLetter?: any;
  allReservations?: readonly Reservation[] | Reservation[];
}

export const ReservationStep3Applicant: React.FC<ReservationStep3ApplicantProps> = React.memo(({
  isWizardMode,
  wizardStep,
  formData,
  setFormData,
  handleResponsableChange,
  uniqueResponsablesList,
  autoFilledContactNotice,
  phoneValidation,
  rutValidation,
  emailValidation,
  primarySpaceCapacityWarning,
  secondSpaceCapacityWarning,
  singleSecondSpace = '',
  responsibleHistoryAlert,
  descargarCartaAlCrear,
  setDescargarCartaAlCrear,
  setShowCommitmentLetterModal,
  editingReservation,
  effectiveFormDataForLetter,
  effectiveSeriesSlotsForLetter,
  allReservations = []
}) => {
  if (isWizardMode && wizardStep !== 3) return null;

  return (
    <div id="reservation-step-3-container" className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-xs">3. Solicitante y Participantes</h3>
            <p className="text-[11px] text-slate-500">Datos de la persona u organización solicitante y aforo esperado</p>
          </div>
        </div>
        {isWizardMode && (
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Paso 3 de 5
          </span>
        )}
      </div>

      <ApplicantContactSection
        formData={formData}
        setFormData={setFormData}
        handleResponsableChange={handleResponsableChange}
        uniqueResponsablesList={uniqueResponsablesList}
        hasAutoFilledContact={autoFilledContactNotice}
        phoneValidation={phoneValidation}
        rutValidation={rutValidation}
        emailValidation={emailValidation}
        primarySpaceCapacityWarning={primarySpaceCapacityWarning}
        secondSpaceCapacityWarning={secondSpaceCapacityWarning}
        singleSecondSpace={singleSecondSpace}
        descargarCartaAlCrear={descargarCartaAlCrear}
        setDescargarCartaAlCrear={setDescargarCartaAlCrear}
        setShowCommitmentLetterModal={setShowCommitmentLetterModal}
        editingReservation={editingReservation}
        effectiveFormDataForLetter={effectiveFormDataForLetter}
        effectiveSeriesSlotsForLetter={effectiveSeriesSlotsForLetter}
        allReservations={allReservations}
        responsibleHistoryAlert={responsibleHistoryAlert}
      />
    </div>
  );
});

ReservationStep3Applicant.displayName = 'ReservationStep3Applicant';
