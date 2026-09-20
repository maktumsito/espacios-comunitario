import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { RefreshCw, Database } from 'lucide-react';

interface AppFooterProps {
  lastSyncTime: number | null;
  isSyncing?: boolean;
  isFirebaseConnected?: boolean;
  totalReservations?: number;
  onManualSync?: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({
  lastSyncTime,
  isSyncing = false,
  isFirebaseConnected = false,
  totalReservations = 0,
  onManualSync
}) => {
  const formattedLastSync = useMemo(() => {
    if (!lastSyncTime) {
      return 'Pendiente de sincronización';
    }
    try {
      return format(new Date(lastSyncTime), 'dd/MM/yyyy HH:mm:ss');
    } catch {
      return 'No disponible';
    }
  }, [lastSyncTime]);

  return (
    <footer
      id="app-footer"
      className="no-print mt-auto border-t border-slate-200/90 bg-white/95 backdrop-blur-xs py-3.5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 shadow-2xs transition-colors"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Left / Primary: System identification & exact required 'Última actualización: [Fecha/Hora]' */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-3 text-center sm:text-left">
          {/* Status Indicator Icon */}
          <div className="flex items-center space-x-1.5" title={isFirebaseConnected ? 'Conectado a Firestore' : 'Modo local activo'}>
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                isSyncing
                  ? 'bg-blue-500 animate-ping'
                  : isFirebaseConnected
                  ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold text-slate-700">
              {isSyncing ? 'Sincronizando...' : isFirebaseConnected ? 'Nube Activa' : 'Caché Local'}
            </span>
          </div>

          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            •
          </span>

          {/* Requested specific phrase: 'Última actualización: [Fecha/Hora]' */}
          <div
            id="footer-last-sync-container"
            className="flex items-center space-x-1.5 text-slate-700 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg shadow-2xs"
            title={lastSyncTime ? `Sincronización confirmada: ${new Date(lastSyncTime).toLocaleString('es-CL')}` : 'Sin sincronización registrada'}
          >
            <span className="text-slate-500">Última actualización:</span>
            <span id="footer-last-sync-value" className="font-bold text-slate-900 font-mono">
              {formattedLastSync}
            </span>
          </div>
        </div>

        {/* Right / Secondary: Cache details, count, and manual sync trigger */}
        <div className="flex items-center justify-center sm:justify-end gap-3 text-slate-500">
          <div className="flex items-center space-x-1.5" title="Reservas en caché local e IndexedDB">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>
              <strong className="text-slate-700">{totalReservations}</strong> {totalReservations === 1 ? 'reserva' : 'reservas'}
            </span>
          </div>

          {onManualSync && (
            <button
              type="button"
              id="btn-footer-manual-sync"
              onClick={onManualSync}
              disabled={isSyncing}
              aria-label="Sincronizar ahora con la base de datos"
              title="Sincronizar ahora"
              className="inline-flex items-center space-x-1 text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2 py-1 rounded-lg transition cursor-pointer disabled:opacity-50 text-[11px] font-semibold"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden md:inline">Sincronizar</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
