import { useState, useEffect } from 'react';
import { AuditChangeLogEntry } from '../types';
import { getAuditHistory, subscribeToAuditLogs } from '../services/auditLogService';

export function useAuditLogs(enabled: boolean = true): {
  auditLogs: AuditChangeLogEntry[];
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditChangeLogEntry[]>>;
} {
  const [auditLogs, setAuditLogs] = useState<AuditChangeLogEntry[]>(() => getAuditHistory());

  useEffect(() => {
    if (!enabled) return;

    const unsubAudit = subscribeToAuditLogs((data) => {
      if (Array.isArray(data)) {
        setAuditLogs(data);
      }
    });

    const handleAuditUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<AuditChangeLogEntry[]>;
      if (customEvent.detail) {
        setAuditLogs(customEvent.detail);
      }
    };

    window.addEventListener('app_audit_changelog_changed', handleAuditUpdate);

    return () => {
      if (typeof unsubAudit === 'function') unsubAudit();
      window.removeEventListener('app_audit_changelog_changed', handleAuditUpdate);
    };
  }, [enabled]);

  return { auditLogs, setAuditLogs };
}
