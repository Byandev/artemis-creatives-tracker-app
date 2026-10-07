/**
 * Prefer Tailwind classes for styling. These hooks are for JS-only consumers
 * (navigation theme, refresh spinner, third-party props that need a color value).
 * Uniwind owns the active theme (light, dark, or following the device), so classes
 * and these values always agree.
 */

import { useUniwind } from 'uniwind';

import { Colors, type ColorScheme } from '@/constants/theme';

export function useColorSchemeName(): ColorScheme {
  const { theme } = useUniwind();
  return theme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useColorSchemeName()];
}
