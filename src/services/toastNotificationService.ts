import { toast as sonnerToast } from 'sonner';

export type ToastType = 'success' | 'info' | 'error' | 'warning';

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Modern notification service powered by Sonner.
 * Handles both plain messages and rich actionable notifications.
 */
export const showToast = {
  success: (message: string, options?: ToastOptions) => {
    sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick
          }
        : undefined
    });
  },

  error: (message: string, options?: ToastOptions) => {
    sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration || 5000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick
          }
        : undefined
    });
  },

  warning: (message: string, options?: ToastOptions) => {
    sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration || 4500,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick
          }
        : undefined
    });
  },

  info: (message: string, options?: ToastOptions) => {
    sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick
          }
        : undefined
    });
  }
};

/**
 * Universal dispatcher compatible with existing triggerSyncToast calls
 */
export function triggerSonnerToast(
  message: string,
  type: ToastType = 'success',
  options?: ToastOptions
) {
  // If the message contains line breaks or detailed error description, split cleanly into title and description
  if (message.includes('\n\n')) {
    const [title, ...rest] = message.split('\n\n');
    const description = rest.join('\n\n');
    showToast[type](title, { ...options, description });
    return;
  }

  showToast[type](message, options);
}
