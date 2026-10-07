import { Check } from 'lucide-react-native';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';

/** Every half hour of the day, as 24-hour "HH:mm". */
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, '0');
  return `${hour}:${i % 2 ? '30' : '00'}`;
});
const ROW_HEIGHT = 48;

/** "17:30" → "5:30 PM" */
export function formatTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

type Props = {
  visible: boolean;
  title: string;
  value: string;
  onSelect: (time: string) => void;
  onClose: () => void;
};

/** Bottom sheet listing the day's times in 30-minute steps. Plain JS: no native picker needed. */
export function TimePickerSheet({ visible, title, value, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const selectedIndex = Math.max(0, TIMES.indexOf(value));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" onPress={onClose} className="flex-1 bg-black/50" />
      <View className="max-h-[60%] rounded-t-xl border-t border-border bg-surface" style={{ paddingBottom: insets.bottom }}>
        <ThemedText type="rowTitle" className="px-4 py-4">
          {title}
        </ThemedText>
        <FlatList
          data={TIMES}
          keyExtractor={(time) => time}
          initialScrollIndex={Math.max(0, selectedIndex - 2)}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          renderItem={({ item }) => {
            const active = item === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => onSelect(item)}
                style={{ height: ROW_HEIGHT }}
                className={`flex-row items-center justify-between px-4 ${active ? 'bg-badge-active' : 'active:bg-row-hover'}`}>
                <ThemedText type={active ? 'labelActive' : 'label'} tone={active ? 'primary' : 'default'}>
                  {formatTime(item)}
                </ThemedText>
                {active && <Icon as={Check} size={18} className="text-primary" />}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
