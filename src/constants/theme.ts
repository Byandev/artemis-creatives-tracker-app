/**
 * JS copies of the Artemis design tokens, for code that can't use Tailwind classes
 * (navigation theme, native tabs, icon sizes, runtime math).
 * Styling lives in src/global.css: keep the two in sync.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    bottomNav: '#FFFFFF',
    text: '#15191A',
    textSecondary: '#5C6461',
    placeholder: '#8A918E',
    chevron: '#8A918E',
    border: '#E3E7E5',
    inputBorder: '#D5DAD8',
    divider: '#EEF1EF',
    rowHover: '#F6F8F7',
    /** Links, tabs and active nav */
    primary: '#047857',
    primaryPressed: '#065F46',
    /** Filled button */
    button: '#047857',
    buttonPressed: '#065F46',
    onButton: '#FFFFFF',
    badge: '#F1F3F2',
    badgeActive: '#E6F4EE',
    focusRing: 'rgba(4, 120, 87, 0.2)',
  },
  dark: {
    background: '#121615',
    surface: '#1A1F1D',
    bottomNav: '#151A18',
    text: '#ECEFED',
    textSecondary: '#9BA4A0',
    placeholder: '#7A8380',
    chevron: '#6E7774',
    border: '#2A302E',
    inputBorder: '#2E3532',
    divider: '#1F2523',
    rowHover: '#1A1F1D',
    primary: '#34D399',
    primaryPressed: '#10B981',
    button: '#10B981',
    buttonPressed: '#059669',
    onButton: '#04241A',
    badge: '#1F2523',
    badgeActive: '#10261E',
    focusRing: 'rgba(52, 211, 153, 0.25)',
  },
} as const;

export type ColorScheme = keyof typeof Colors;

export type CreativeStatus = 'pending' | 'approved' | 'revision';

export const StatusLabels: Record<CreativeStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  revision: 'For Revision',
};

/**
 * Geist families as registered by `useFonts` in the root layout.
 * Use one family per weight instead of `fontWeight` so Android picks the right face.
 */
export const FontFamily = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

/** 8pt grid. 4 and 12 are half-steps for use inside components only. */
export const Spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  10: 40,
  16: 64,
  24: 96,
} as const;

export const IconSize = {
  topBar: 20,
  nav: 22,
  thumbnail: 22,
  strokeWidth: 1.75,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
