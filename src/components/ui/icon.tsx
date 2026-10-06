import type { LucideIcon } from 'lucide-react-native';
import { useResolveClassNames } from 'uniwind';

import { IconSize } from '@/constants/theme';

export type IconProps = {
  as: LucideIcon;
  /** Tailwind text color class, e.g. "text-placeholder". */
  className?: string;
  size?: number;
};

/** Lucide icon at the spec's 1.75px stroke, colored with a Tailwind text-* class. */
export function Icon({ as: Component, className = 'text-foreground', size = IconSize.topBar }: IconProps) {
  const { color } = useResolveClassNames(className);

  return (
    <Component
      size={size}
      strokeWidth={IconSize.strokeWidth}
      absoluteStrokeWidth
      color={typeof color === 'string' ? color : undefined}
    />
  );
}
