import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageAnnotator, type Mark } from '@/components/creatives/image-annotator';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import type { Region } from '@/lib/creatives';

type RegionPickerProps = {
  visible: boolean;
  uri: string;
  /** Other reviews' marks, for context. */
  marks: Mark[];
  /** The area already picked, to adjust. */
  value: Region | null;
  onDone: (region: Region | null) => void;
  onCancel: () => void;
};

/** Full screen, so there's room to be precise: drag to mark an area, or tap a spot. */
export function RegionPicker({ visible, uri, marks, value, onDone, onCancel }: RegionPickerProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Region | null>(value);

  // Start from the current pick each time it opens (set during render, not in an effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(value);
  }

  const hint = draft
    ? draft.w === 0 && draft.h === 0
      ? 'Point marked. Drag to mark an area instead.'
      : 'Area marked. Draw again to change it.'
    : 'Drag to mark an area, or tap a spot.';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="h-14 flex-row items-center gap-2 px-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel marking"
            onPress={onCancel}
            className="size-11 items-center justify-center rounded-full active:bg-white/10">
            <Icon as={X} size={22} className="text-white" />
          </Pressable>
          <ThemedText type="rowTitle" tone="white" className="flex-1">
            Mark on image
          </ThemedText>
          {draft && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft(null)}
              className="h-9 justify-center rounded-full px-3 active:bg-white/10">
              <ThemedText type="label" tone="white">
                Clear
              </ThemedText>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done marking"
            onPress={() => onDone(draft)}
            className="h-9 justify-center rounded-full bg-button px-4 active:bg-button-pressed">
            <ThemedText type="labelActive" tone="onButton">
              Done
            </ThemedText>
          </Pressable>
        </View>

        <View className="flex-1">
          <ImageAnnotator uri={uri} marks={marks} draft={draft} onDraw={setDraft} />
        </View>

        <ThemedText type="meta" tone="white" className="px-4 py-3 text-center opacity-80" accessibilityLiveRegion="polite">
          {hint}
        </ThemedText>
      </View>
    </Modal>
  );
}
