import { ChevronDown } from 'lucide-react-native';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { StatusLabels, type CreativeStatus } from '@/constants/theme';

// Full class strings so Tailwind picks them up.
const STATUS_CLASSES: Record<
  CreativeStatus,
  { box: string; dot: string; icon: string; tone: 'pending' | 'approved' | 'rejected' }
> = {
  pending: { box: 'bg-pending-fill border-pending-border', dot: 'bg-pending-dot', icon: 'text-pending', tone: 'pending' },
  approved: {
    box: 'bg-approved-fill border-approved-border',
    dot: 'bg-approved-dot',
    icon: 'text-approved',
    tone: 'approved',
  },
  revision: {
    box: 'bg-rejected-fill border-rejected-border',
    dot: 'bg-rejected-dot',
    icon: 'text-rejected',
    tone: 'rejected',
  },
};

type StatusLabelProps = {
  status: CreativeStatus;
  /** Overrides the default text, e.g. "Pending Review". */
  label?: string;
  /** Adds a chevron, for a label that opens a status picker. */
  editable?: boolean;
};

export function StatusLabel({ status, label, editable }: StatusLabelProps) {
  const classes = STATUS_CLASSES[status];

  return (
    <View className={`h-[22px] flex-row items-center gap-1.5 self-start rounded-sm border px-2 ${classes.box}`}>
      <View className={`size-1.5 rounded-full ${classes.dot}`} />
      <ThemedText type="caption" tone={classes.tone}>
        {label ?? StatusLabels[status]}
      </ThemedText>
      {editable && <Icon as={ChevronDown} size={12} className={classes.icon} />}
    </View>
  );
}
