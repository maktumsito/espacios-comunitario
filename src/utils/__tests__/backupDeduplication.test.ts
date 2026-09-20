import { describe, it, expect } from 'vitest';
import { getBackupIdentitySignature, DatabaseBackupMetadata } from '../../services/backupService';

describe('backupDeduplication', () => {
  it('generates matching signatures for backups with same date, hour/minute, size KB, and reservations count', () => {
    const backupA: DatabaseBackupMetadata = {
      id: 'BACKUP_20260320_143000_AUTO15D',
      fecha: '2026-03-20',
      timestamp: '2026-03-20T14:30:15.123Z',
      tipo: 'automatica_15_dias',
      creadoPor: 'Sistema',
      totalReservas: 42,
      totalEspacios: 8,
      totalUsuarios: 3,
      totalCalificaciones: 5,
      totalEquipamiento: 10,
      checksum: 'CHK_11111111',
      tamanoBytes: 102400, // 100 KB
      descripcion: 'Copia 1'
    };

    const backupB: DatabaseBackupMetadata = {
      id: 'BACKUP_20260320_143045_MANUAL',
      fecha: '2026-03-20',
      timestamp: '2026-03-20T14:30:45.999Z',
      tipo: 'manual',
      creadoPor: 'Admin',
      totalReservas: 42,
      totalEspacios: 8,
      totalUsuarios: 3,
      totalCalificaciones: 5,
      totalEquipamiento: 10,
      checksum: 'CHK_22222222', // different checksum due to timestamps
      tamanoBytes: 102400, // 100 KB
      descripcion: 'Copia 2'
    };

    const sigA = getBackupIdentitySignature(backupA);
    const sigB = getBackupIdentitySignature(backupB);

    expect(sigA).toBe('2026-03-20_14:30_100KB_42RSV');
    expect(sigB).toBe('2026-03-20_14:30_100KB_42RSV');
    expect(sigA).toBe(sigB);
  });

  it('generates different signatures if reservations count or hour differ', () => {
    const backupA: DatabaseBackupMetadata = {
      id: 'BACKUP_20260320_143000_AUTO15D',
      fecha: '2026-03-20',
      timestamp: '2026-03-20T14:30:00.000Z',
      tipo: 'automatica_15_dias',
      creadoPor: 'Sistema',
      totalReservas: 42,
      totalEspacios: 8,
      totalUsuarios: 3,
      totalCalificaciones: 5,
      totalEquipamiento: 10,
      checksum: 'CHK_111',
      tamanoBytes: 102400,
      descripcion: ''
    };

    const backupC: DatabaseBackupMetadata = {
      ...backupA,
      totalReservas: 43
    };

    expect(getBackupIdentitySignature(backupA)).not.toBe(getBackupIdentitySignature(backupC));
  });
});
