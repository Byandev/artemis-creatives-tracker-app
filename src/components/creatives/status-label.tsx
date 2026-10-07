import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { StatusLabels, type CreativeStatus } from '@/constants/theme';

// Full class strings so Tailwind picks them up.
const STATUS_CLASSES: Record<CreativeStatus, { box: string; dot: string; tone: 'pending' | 'approved' | 'rejected' }> = {
  pending: { box: 'bg-pending-fill border-pending-border', dot: 'bg-pending-dot', tone: 'pending' },
  approved: { box: 'bg-approved-fill border-approved-border', dot: 'bg-approved-dot', tone: 'approved' },
  rejected: { box: 'bg-rejected-fill border-rejected-border', dot: 'bg-rejected-dot', tone: 'rejected' },
};

export function StatusLabel({ status }: { status: CreativeStatus }) {
  const classes = STATUS_CLASSES[status];

  return (
    <View className={`h-[22px] flex-row items-center gap-1.5 rounded-sm border px-2 ${classes.box}`}>
      <View className={`size-1.5 rounded-full ${classes.dot}`} />
      <ThemedText type="caption" tone={classes.tone}>
        {StatusLabels[status]}
      </ThemedText>
    </View>
  );
}
