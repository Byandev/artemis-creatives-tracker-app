import { View, type ViewProps } from 'react-native';

const SURFACE_CLASSES = {
  background: 'bg-background',
  surface: 'bg-surface',
  badge: 'bg-badge',
  badgeActive: 'bg-badge-active',
  rowHover: 'bg-row-hover',
} as const;

export type ThemedViewProps = ViewProps & {
  type?: keyof typeof SURFACE_CLASSES;
};

export function ThemedView({ type = 'background', className, ...otherProps }: ThemedViewProps) {
  return <View className={`${SURFACE_CLASSES[type]} ${className ?? ''}`} {...otherProps} />;
}
