import { LogOut } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TopBar } from '@/components/top-bar';
import { Icon } from '@/components/ui/icon';
import { useSession } from '@/providers/session';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();

  return (
    <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
      <TopBar title="Profile" />
      <View className="gap-6 px-4 pt-4">
        <View className="gap-1">
          <ThemedText type="rowTitle">{user?.name ?? '—'}</ThemedText>
          <ThemedText tone="muted">{user?.email}</ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          className="h-12 flex-row items-center justify-center gap-2 rounded-md border border-input-border bg-surface active:bg-row-hover">
          <Icon as={LogOut} className="text-rejected" />
          <ThemedText type="button" tone="rejected">
            Log out
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}
