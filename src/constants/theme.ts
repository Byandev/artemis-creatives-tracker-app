/**
 * Artemis Creatives Tracker design tokens.
 * Colors, status colors, typography (Geist), spacing (8pt grid), sizes, radii and borders.
 */

import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

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
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export type CreativeStatus = 'pending' | 'approved' | 'rejected';

export const StatusLabels: Record<CreativeStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const StatusColors = {
  light: {
    pending: { text: '#A15C07', fill: '#FFF8EB', border: '#F3DDB0', dot: '#D97706' },
    approved: { text: '#047857', fill: '#EEFBF5', border: '#BFE8D6', dot: '#10B981' },
    rejected: { text: '#B42318', fill: '#FEF3F2', border: '#F5C9C4', dot: '#E5484D' },
  },
  dark: {
    pending: { text: '#F5B84A', fill: '#2A2112', border: '#4A3815', dot: '#F59E0B' },
    approved: { text: '#34D399', fill: '#10261E', border: '#1D4535', dot: '#34D399' },
    rejected: { text: '#F38B85', fill: '#2B1716', border: '#4D2522', dot: '#F06A63' },
  },
} as const satisfies Record<
  ColorScheme,
  Record<CreativeStatus, { text: string; fill: string; border: string; dot: string }>
>;

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

export const Fonts = {
  ...FontFamily,
  mono: Platform.select({ ios: 'ui-monospace', web: 'var(--font-mono)', default: 'monospace' }),
};

/** Converts an em letter-spacing to the px value React Native expects. */
const em = (size: number, value: number) => Math.round(size * value * 100) / 100;

export const Typography = {
  /** ARTEMIS wordmark on login */
  wordmark: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 24, letterSpacing: em(20, 0.16) },
  /** "Creatives for Review" */
  pageTitle: { fontFamily: FontFamily.semibold, fontSize: 17, lineHeight: 24, letterSpacing: em(17, -0.01) },
  input: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 20 },
  button: { fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  /** Creative name in a list row; pair with numberOfLines={1} */
  rowTitle: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 20 },
  /** Form labels, filter tabs, links */
  label: { fontFamily: FontFamily.medium, fontSize: 13, lineHeight: 16 },
  labelActive: { fontFamily: FontFamily.semibold, fontSize: 13, lineHeight: 16 },
  /** Meta, dates */
  meta: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 16 },
  /** Type filter */
  metaMedium: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 16 },
  /** CREATIVES TRACKER eyebrow (emerald) */
  eyebrow: { fontFamily: FontFamily.semibold, fontSize: 11, lineHeight: 16, letterSpacing: em(11, 0.14) },
  sectionLabel: { fontFamily: FontFamily.semibold, fontSize: 11, lineHeight: 16, letterSpacing: em(11, 0.08) },
  /** Status labels, count badges, nav labels */
  caption: { fontFamily: FontFamily.semibold, fontSize: 11, lineHeight: 16 },
  code: { fontFamily: Fonts.mono, fontSize: 12 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof Typography;

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

export const ScreenPadding = {
  login: Spacing[6],
  list: Spacing[4],
} as const;

export const Sizes = {
  topBar: 56,
  statusTabs: 44,
  typeFilterRow: 48,
  bottomNav: 64,
  /** Inputs and buttons */
  control: 48,
  iconButton: 44,
  thumbnail: 56,
  rowPaddingVertical: Spacing[3],
  rowGap: Spacing[3],
  statusLabel: { height: 22, paddingHorizontal: Spacing[2], dot: 6 },
  countBadge: 18,
} as const;

export const Radius = {
  /** Status labels, badges, segments */
  sm: 4,
  /** Inputs, buttons, thumbnails */
  md: 6,
  /** Logo mark */
  lg: 10,
} as const;

export const IconSize = {
  topBar: 20,
  nav: 22,
  thumbnail: 22,
  strokeWidth: 1.75,
} as const;

export const BorderWidth = {
  hairline: 1,
  tabUnderline: 2,
  focusRing: 3,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
