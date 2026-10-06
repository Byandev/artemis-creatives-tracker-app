import type { LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';

export type TextFieldProps = TextInputProps & {
  label: string;
  icon?: LucideIcon;
  /** Rendered at the right edge of the input, e.g. a show/hide password button. */
  trailing?: ReactNode;
  /** Message shown under the input; also turns the border red. */
  error?: string | null;
  ref?: Ref<TextInput>;
};

export function TextField({ label, icon, trailing, error, onFocus, onBlur, className, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-2">
      <ThemedText type="label">{label}</ThemedText>
      <View
        className={`h-12 flex-row items-center gap-3 rounded-md border bg-surface pl-4 pr-1 ${
          error ? 'border-rejected' : focused ? 'border-primary' : 'border-input-border'
        }`}>
        {/* 3px focus ring drawn outside the 1px border */}
        {focused && (
          <View
            pointerEvents="none"
            className="absolute -inset-1 rounded-[10px] border-[3px] border-focus-ring"
          />
        )}
        {icon && <Icon as={icon} className="text-placeholder" />}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColorClassName="accent-placeholder"
          selectionColorClassName="accent-primary"
          cursorColorClassName="accent-primary"
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={`h-full flex-1 pr-3 font-sans text-[15px] text-foreground web:outline-none ${className ?? ''}`}
          {...rest}
        />
        {trailing}
      </View>
      {error ? (
        <ThemedText type="meta" tone="rejected" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
