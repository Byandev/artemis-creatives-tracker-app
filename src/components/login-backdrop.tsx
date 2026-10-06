import { StyleSheet } from 'react-native';
import Svg, { Defs, Mask, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useCSSVariable, useUniwind } from 'uniwind';

import { Spacing } from '@/constants/theme';

const CELL = Spacing[8];

/** Square grid behind the login form, fading out toward the edges, with a soft glow behind the logo. */
export function LoginBackdrop() {
  const { theme } = useUniwind();
  const [lineColor, glowColor] = useCSSVariable(['--color-input-border', '--color-primary']);

  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id="grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <Path
            d={`M ${CELL} 0 L 0 0 0 ${CELL}`}
            fill="none"
            stroke={String(lineColor)}
            strokeWidth={1}
          />
        </Pattern>
        <RadialGradient id="fade" cx="50%" cy="40%" rx="70%" ry="50%" fx="50%" fy="40%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <Mask id="fade-mask">
          <Rect width="100%" height="100%" fill="url(#fade)" />
        </Mask>
        <RadialGradient id="glow" cx="50%" cy="28%" rx="60%" ry="28%" fx="50%" fy="28%">
          <Stop offset="0" stopColor={String(glowColor)} stopOpacity={theme === 'dark' ? 0.14 : 0.08} />
          <Stop offset="1" stopColor={String(glowColor)} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" mask="url(#fade-mask)" />
      <Rect width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}
