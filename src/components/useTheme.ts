import { useEffect } from 'react';
import type { Theme } from '../../shared/types';

/**
 * Applies the active theme to <html data-theme="...">.
 * Mount once at the top of each renderer (overlay, settings, onboarding).
 * Also kicks off ambient audio when entering a break (overlay only —
 * passes through otherwise).
 */
export function useTheme(theme: Theme | undefined | null) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme && theme !== root.getAttribute('data-theme')) {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);
}
