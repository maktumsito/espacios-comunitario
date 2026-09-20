/**
 * Device and viewport detection utilities for mobile-optimized experience.
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Check navigator.userAgent / vendor regex for mobile phones/tablets
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const mobileUARegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
  const isMobileUA = mobileUARegex.test(userAgent);

  // 2. Check viewport screen width (smartphones: <= 768px)
  const isSmallScreen = window.innerWidth <= 768;

  // 3. Touch device capability
  const hasTouchCapability =
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    'ontouchstart' in window;

  return isMobileUA || (isSmallScreen && hasTouchCapability) || isSmallScreen;
}

const VIEW_PREFERENCE_STORAGE_KEY = 'gestindeespacios_preferred_view_mode';

/**
 * Returns the view mode to load initially.
 * Automatically defaults to 'mobile' if accessed from a mobile phone / handheld device.
 */
export function getInitialViewMode(): 'mobile' | 'daily' {
  if (typeof window === 'undefined') return 'daily';

  try {
    const saved = sessionStorage.getItem(VIEW_PREFERENCE_STORAGE_KEY);
    if (saved === 'mobile' || saved === 'daily' || saved === 'calendar' || saved === 'timeline') {
      return saved as any;
    }
  } catch {
    // Ignore storage restrictions
  }

  // If loading from a smartphone / small screen, load the mobile optimized view automatically
  if (isMobileDevice()) {
    return 'mobile';
  }

  return 'daily';
}

/**
 * Persists the user preference when they explicitly switch views.
 */
export function persistViewPreference(mode: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(VIEW_PREFERENCE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage restrictions
  }
}
