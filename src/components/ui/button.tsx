import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';

import { Icon } from '@/components/ui/icon';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  /** Icon pinned to the right edge, e.g. an arrow. */
  trailingIcon?: LucideIcon;
  loading?: boolean;
};

export function Button({ label, trailingIcon, loading, disabled, className, ...rest }: ButtonProps) {
  const inactive = !!disabled || !!loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      disabled={inactive}
      className={`h-12 items-center justify-center rounded-md px-4 bg-button active:bg-button-pressed disabled:opacity-60 ${className ?? ''}`}
      {...rest}>
      {loading ? (
        <ActivityIndicator colorClassName="accent-on-button" />
      ) : (
        <Text className="font-sans-semibold text-input text-on-button">{label}</Text>
      )}
      {trailingIcon && !loading && (
        <View pointerEvents="none" className="absolute right-4">
          <Icon as={trailingIcon} className="text-on-button" />
        </View>
      )}
    </Pressable>
  );
}
