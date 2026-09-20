import { useState, useEffect } from 'react';

export interface UseNetworkStatusReturn {
  isOnline: boolean;
  showReconnectedAlert: boolean;
  dismissReconnectedAlert: () => void;
}

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedAlert, setShowReconnectedAlert] = useState<boolean>(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedAlert(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShowReconnectedAlert(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedAlert(false);
      if (timer) clearTimeout(timer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dismissReconnectedAlert = () => setShowReconnectedAlert(false);

  return { isOnline, showReconnectedAlert, dismissReconnectedAlert };
}
