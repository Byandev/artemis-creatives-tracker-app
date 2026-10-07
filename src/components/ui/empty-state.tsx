import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Emerald for good news ("all caught up"), neutral for no results, red for errors. */
  tone?: 'positive' | 'neutral' | 'error';
  action?: { label: string; onPress: () => void };
};

const TONE_CLASSES = {
  positive: { circle: 'bg-badge-active border-approved-border', icon: 'text-primary' },
  neutral: { circle: 'bg-badge border-border', icon: 'text-muted' },
  error: { circle: 'bg-rejected-fill border-rejected-border', icon: 'text-rejected' },
} as const;

/** Centered icon, title, description and an optional button, for empty lists and errors. */
export function EmptyState({ icon, title, description, tone = 'neutral', action }: EmptyStateProps) {
  const classes = TONE_CLASSES[tone];

  return (
    <View className="items-center px-8 pb-10 pt-20">
      <View className={`mb-5 size-16 items-center justify-center rounded-full border ${classes.circle}`}>
        <Icon as={icon} size={28} className={classes.icon} />
      </View>
      <ThemedText type="pageTitle" className="text-center">
        {title}
      </ThemedText>
      {description ? (
        <ThemedText tone="muted" className="mt-1.5 max-w-[280px] text-center">
          {description}
        </ThemedText>
      ) : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          className="mt-6 h-10 justify-center rounded-md border border-input-border bg-surface px-4 active:bg-row-hover">
          <ThemedText type="labelActive">{action.label}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}
