import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Placeholder with the same layout as CreativeRow, pulsing while the list loads. */
export function CreativeRowSkeleton() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className="flex-row items-center gap-3 border-b border-divider px-4 py-3">
      <Animated.View style={pulse} className="flex-1 flex-row items-center gap-3">
        <View className="size-14 rounded-md bg-border" />
        <View className="flex-1 gap-2">
          <View className="h-3.5 w-3/5 rounded-sm bg-border" />
          <View className="h-3 w-2/5 rounded-sm bg-border" />
          <View className="mt-1 flex-row items-center justify-between">
            <View className="h-3 w-20 rounded-sm bg-border" />
            <View className="h-[22px] w-28 rounded-sm bg-border" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/** A few skeleton rows (with the section header placeholder) for the first load. */
export function CreativeListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading creatives" accessibilityRole="progressbar">
      <View className="px-4 pb-2 pt-6">
        <View className="h-3 w-28 rounded-sm bg-border" />
      </View>
      {Array.from({ length: rows }, (_, index) => (
        <CreativeRowSkeleton key={index} />
      ))}
    </View>
  );
}
