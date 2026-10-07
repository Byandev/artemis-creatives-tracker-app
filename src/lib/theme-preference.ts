import { Uniwind, useUniwind } from 'uniwind';

import { storage } from '@/lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const KEY = 'artemis.theme';

/** Applies the saved theme (default: follow the device). Call once on launch. */
export async function restoreThemePreference() {
  try {
    const saved = await storage.get(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      Uniwind.setTheme(saved);
    }
  } catch {
    // Keep the system theme if storage is unavailable.
  }
}

/** Current choice plus a setter that applies it app-wide and remembers it on this device. */
export function useThemePreference() {
  const { theme, hasAdaptiveThemes } = useUniwind();
  const preference: ThemePreference = hasAdaptiveThemes ? 'system' : (theme as ThemePreference);

  function setPreference(next: ThemePreference) {
    Uniwind.setTheme(next);
    storage.set(KEY, next).catch(() => {});
  }

  return { preference, setPreference };
}
