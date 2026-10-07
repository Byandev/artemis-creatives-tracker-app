import { Search, X } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onCancel: () => void;
};

/** Replaces the top bar while searching. Matches code, name and headline on the server. */
export function SearchBar({ value, onChangeText, onCancel }: SearchBarProps) {
  return (
    <View className="h-14 flex-row items-center gap-3 px-4">
      <View className="h-10 flex-1 flex-row items-center gap-2 rounded-md border border-input-border bg-surface pl-3 pr-1">
        <Icon as={Search} className="text-placeholder" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Search by name, code or headline"
          placeholderTextColorClassName="accent-placeholder"
          selectionColorClassName="accent-primary"
          cursorColorClassName="accent-primary"
          accessibilityLabel="Search creatives"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="h-full flex-1 font-sans text-[15px] text-foreground web:outline-none"
        />
        {value.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={Spacing[1]}
            onPress={() => onChangeText('')}
            className="size-8 items-center justify-center">
            <Icon as={X} size={18} className="text-chevron" />
          </Pressable>
        )}
      </View>
      <Pressable accessibilityRole="button" hitSlop={Spacing[2]} onPress={onCancel}>
        <ThemedText type="label" tone="primary">
          Cancel
        </ThemedText>
      </Pressable>
    </View>
  );
}
