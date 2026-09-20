import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onToggleCommandPalette: () => void;
  onOpenNewReservation?: () => void;
  isCommandPaletteOpen: boolean;
}

/**
 * Custom hook to manage global keyboard shortcuts for the application.
 * - Ctrl+K / Cmd+K: Toggle the Global Command Palette
 * - '/': Open the Command Palette if not currently typing in an input
 */
export function useKeyboardShortcuts({
  onToggleCommandPalette,
  onOpenNewReservation,
  isCommandPaletteOpen
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggleCommandPalette();
        return;
      }

      // 2. '/' to open spotlight when user isn't in an active text input or editable element
      if (e.key === '/' && !isCommandPaletteOpen) {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (
          tagName !== 'input' &&
          tagName !== 'textarea' &&
          tagName !== 'select' &&
          !target?.isContentEditable
        ) {
          e.preventDefault();
          onToggleCommandPalette();
          return;
        }
      }

      // 3. Alt+N or 'n' shortcut for new reservation when not in active input
      if (
        (e.altKey && e.key.toLowerCase() === 'n') &&
        onOpenNewReservation
      ) {
        e.preventDefault();
        onOpenNewReservation();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onToggleCommandPalette, onOpenNewReservation, isCommandPaletteOpen]);
}
