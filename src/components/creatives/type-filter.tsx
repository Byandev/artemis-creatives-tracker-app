import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export type TypeFilterValue = 'all' | 'image' | 'video';

const OPTIONS: { key: TypeFilterValue; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Image' },
  { key: 'video', label: 'Video' },
];

type TypeFilterProps = {
  /** null while loading: shows a placeholder instead of the count. */
  total: number | null;
  value: TypeFilterValue;
  onChange: (value: TypeFilterValue) => void;
};

/** "8 creatives" on the left, All / Image / Video segments on the right. */
export function TypeFilter({ total, value, onChange }: TypeFilterProps) {
  return (
    <View className="h-12 flex-row items-center justify-between border-b border-border px-4">
      {total === null ? (
        <View className="h-3 w-20 rounded-sm bg-border" />
      ) : (
        <ThemedText type="meta" tone="muted">
          {total} {total === 1 ? 'creative' : 'creatives'}
        </ThemedText>
      )}
      <View accessibilityRole="radiogroup" className="flex-row gap-1">
        {OPTIONS.map((option) => {
          const active = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option.key)}
              className={`h-8 justify-center rounded-sm border px-3 ${
                active ? 'border-border bg-badge' : 'border-transparent'
              }`}>
              <ThemedText type="metaMedium" tone={active ? 'default' : 'muted'}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
