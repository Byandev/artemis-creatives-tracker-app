import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { LogoMark } from '@/components/logo-mark';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';

export type TopBarAction = { icon: LucideIcon; label: string; onPress?: () => void };

/** 56px app bar: Artemis logo, page title, and up to a few 44×44 icon buttons. */
export function TopBar({ title, actions = [] }: { title: string; actions?: TopBarAction[] }) {
  return (
    <View className="h-14 flex-row items-center gap-3 pl-4 pr-1.5">
      <LogoMark size={32} />
      <ThemedText type="pageTitle" numberOfLines={1} className="flex-1">
        {title}
      </ThemedText>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          className="size-11 items-center justify-center rounded-md active:bg-row-hover">
          <Icon as={action.icon} />
        </Pressable>
      ))}
    </View>
  );
}
