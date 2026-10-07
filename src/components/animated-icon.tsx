import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

// Must match the expo-splash-screen config in app.json, so the hand-off from the
// native splash to this overlay is seamless.
const SPLASH_BACKGROUND = '#047857';
const LOGO_WIDTH = 120;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 510) / 490); // artemis-logo.png is 490×510

/**
 * Green splash with the Artemis logo zooming in, shown once the app is ready:
 * the logo pops in, keeps zooming while the green fades out to reveal the app.
 */
export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function start() {
    scale.value = withSequence(
      withTiming(1.25, { duration: 520, easing: Easing.out(Easing.back(1.8)) }),
      withTiming(2.2, { duration: 380, easing: Easing.in(Easing.cubic) }),
    );
    opacity.value = withDelay(
      600,
      withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      }),
    );
  }

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={() => {
        // The overlay now covers the screen exactly like the native splash, so swap them.
        SplashScreen.hideAsync().finally(start);
      }}
      style={[styles.overlay, backdropStyle]}>
      <Animated.View style={logoStyle}>
        <Image
          source={require('@/assets/images/logo/artemis-logo.png')}
          style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
