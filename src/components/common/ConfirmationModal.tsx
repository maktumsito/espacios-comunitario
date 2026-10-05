import React, { useEffect, useRef, useState } from 'react';
import { BaseModal } from './BaseModal';
import { AlertTriangle, Info, Trash2, CheckCircle2 } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  isProcessing?: boolean;
  hideCancel?: boolean;
  secondaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    className?: string;
  };
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  onConfirm,
  onCancel,
  isProcessing = false,
  hideCancel = false,
  secondaryAction
}) => {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (isOpen) setError(''); }, [isOpen, title]);
  const processing = isProcessing || pending;
  const perform = async (action: () => void | Promise<void>) => {
    if (pendingRef.current || processing) return;
    pendingRef.current = true; setPending(true); setError('');
    try { await action(); }
    catch (err: any) { setError(err?.message || 'No se pudo completar la operación. Puedes reintentar.'); }
    finally { pendingRef.current = false; setPending(false); }
  };
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 className="w-5 h-5 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-sky-600" />;
      case 'primary':
      default:
        return <CheckCircle2 className="w-5 h-5 text-blue-600" />;
    }
  };

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20';
      case 'info':
        return 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20';
      case 'primary':
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20';
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => { void perform(onCancel); }}
      title={title}
      icon={getIcon()}
      maxWidth="md"
      layer="nested"
      role="alertdialog"
      closeOnBackdrop={!processing}
      showCloseButton={!processing}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 w-full">
          {!hideCancel && (
            <button
              type="button"
              onClick={() => { void perform(onCancel); }}
              disabled={processing}
              className="min-h-[44px] px-4 py-2 rounded-xl text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 text-xs sm:text-sm font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={() => { void perform(secondaryAction.onClick); }}
              disabled={processing}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${secondaryAction.className || 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => { void perform(onConfirm); }}
            disabled={processing}
            className={`min-h-[44px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center cursor-pointer disabled:opacity-50 ${getConfirmButtonClasses()}`}
          >
            {processing ? (
              <span className="flex items-center space-x-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Procesando...</span>
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      }
    >
      <div className="text-sm text-slate-600 leading-relaxed py-1">
        {typeof message === 'string' ? <p>{message}</p> : message}
        {error && <p role="alert" className="mt-3 text-rose-700">{error}</p>}
      </div>
    </BaseModal>
  );
};
