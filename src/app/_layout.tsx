import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from '@expo-google-fonts/geist';
import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Colors, FontFamily } from '@/constants/theme';
import { useColorSchemeName } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync();

function navigationTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
    fonts: {
      regular: { fontFamily: FontFamily.regular, fontWeight: '400' },
      medium: { fontFamily: FontFamily.medium, fontWeight: '500' },
      bold: { fontFamily: FontFamily.semibold, fontWeight: '600' },
      heavy: { fontFamily: FontFamily.bold, fontWeight: '700' },
    },
  };
}

export default function TabLayout() {
  const scheme = useColorSchemeName();
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });

  // Keep the native splash up until Geist is ready (AnimatedSplashOverlay hides it).
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
