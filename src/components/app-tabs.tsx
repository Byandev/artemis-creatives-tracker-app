import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { LayoutGrid, User, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { IconSize } from '@/constants/theme';

/** Custom 64px bottom navigation matching the Artemis design. */
export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot />
      <TabList asChild>
        <View
          className="flex-row border-t border-border bg-bottom-nav"
          style={{ paddingBottom: insets.bottom }}>
          <TabTrigger name="index" href="/" asChild>
            <NavButton icon={LayoutGrid} label="Creatives" />
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <NavButton icon={User} label="Profile" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

type NavButtonProps = TabTriggerSlotProps & { icon: LucideIcon; label: string };

// `style` is dropped on purpose: TabTrigger injects a row/space-between style that would override the classes.
function NavButton({ icon, label, isFocused, style: _triggerStyle, ...props }: NavButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      className="h-16 flex-1 items-center justify-center gap-1">
      <Icon as={icon} size={IconSize.nav} className={isFocused ? 'text-primary' : 'text-muted'} />
      <ThemedText type="caption" tone={isFocused ? 'primary' : 'muted'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
