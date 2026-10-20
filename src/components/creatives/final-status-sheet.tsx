import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusLabel } from '@/components/creatives/status-label';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ApiError, creativesApi } from '@/lib/api';
import { publishCreative } from '@/lib/creative-store';
import { FINAL_STATUS_OPTIONS, finalStatusBadge, type Creative, type FinalStatus } from '@/lib/creatives';
import { useSession } from '@/providers/session';

type Props = {
  /** The creative to change; null keeps the sheet closed. */
  creative: Creative | null;
  onClose: () => void;
};

/**
 * Bottom sheet for setting a creative's final status in one tap. Saves straight away and
 * publishes the result, so every list and the detail screen pick it up.
 */
export function FinalStatusSheet({ creative, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { token, signOut } = useSession();
  const [saving, setSaving] = useState<FinalStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear a failed attempt's message, so it doesn't show the next time the sheet opens.
  function close() {
    setError(null);
    onClose();
  }

  async function choose(status: FinalStatus) {
    if (!creative || !token || saving) return;
    if (status === creative.final_status) {
      close();
      return;
    }
    setSaving(status);
    setError(null);
    try {
      const { data } = await creativesApi.updateFinalStatus(token, creative.id, status);
      publishCreative(data);
      close();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return;
      }
      setError(err instanceof ApiError && err.status < 500 ? err.message : 'Couldn’t save. Try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal visible={creative !== null} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" onPress={close} className="flex-1 bg-black/50" />
      <View className="rounded-t-xl border-t border-border bg-surface" style={{ paddingBottom: insets.bottom + 8 }}>
        <View className="gap-0.5 px-4 pb-2 pt-4">
          <ThemedText type="rowTitle">Final status</ThemedText>
          {creative && (
            <ThemedText type="meta" tone="muted" numberOfLines={1}>
              {creative.name}
            </ThemedText>
          )}
        </View>

        {FINAL_STATUS_OPTIONS.map((option) => {
          const active = option.value === creative?.final_status;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, busy: saving === option.value }}
              disabled={saving !== null}
              onPress={() => choose(option.value)}
              className={`min-h-14 flex-row items-center gap-3 px-4 py-2 ${active ? 'bg-badge-active' : 'active:bg-row-hover'}`}>
              <View className="flex-1 gap-1">
                <StatusLabel status={finalStatusBadge(option.value)} label={option.label} />
                <ThemedText type="meta" tone="muted">
                  {option.description}
                </ThemedText>
              </View>
              {saving === option.value ? (
                <ActivityIndicator colorClassName="accent-primary" />
              ) : (
                active && <Icon as={Check} size={18} className="text-primary" />
              )}
            </Pressable>
          );
        })}

        {error && (
          <ThemedText type="meta" tone="rejected" accessibilityLiveRegion="polite" className="px-4 pt-2">
            {error}
          </ThemedText>
        )}
      </View>
    </Modal>
  );
}
