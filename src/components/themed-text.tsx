import { Text, type TextProps } from 'react-native';

// Full class strings only: Tailwind can't see classes built at runtime.
const TYPE_CLASSES = {
  wordmark: 'font-sans-bold text-wordmark tracking-wordmark',
  pageTitle: 'font-sans-semibold text-title tracking-title',
  input: 'font-sans text-input',
  button: 'font-sans-semibold text-input',
  body: 'font-sans text-body',
  rowTitle: 'font-sans-semibold text-body',
  label: 'font-sans-medium text-label',
  labelActive: 'font-sans-semibold text-label',
  meta: 'font-sans text-meta',
  metaMedium: 'font-sans-medium text-meta',
  eyebrow: 'font-sans-semibold text-caption tracking-eyebrow uppercase',
  sectionLabel: 'font-sans-semibold text-caption tracking-section uppercase',
  caption: 'font-sans-semibold text-caption',
  code: 'font-mono text-meta',
} as const;

const TONE_CLASSES = {
  default: 'text-foreground',
  muted: 'text-muted',
  placeholder: 'text-placeholder',
  primary: 'text-primary',
  onButton: 'text-on-button',
  pending: 'text-pending',
  approved: 'text-approved',
  rejected: 'text-rejected',
  /** On photos and black backgrounds, in both themes. */
  white: 'text-white',
} as const;

export type TextType = keyof typeof TYPE_CLASSES;
export type TextTone = keyof typeof TONE_CLASSES;

export type ThemedTextProps = TextProps & {
  type?: TextType;
  tone?: TextTone;
};

export function ThemedText({ type = 'body', tone = 'default', className, ...rest }: ThemedTextProps) {
  return <Text className={`${TYPE_CLASSES[type]} ${TONE_CLASSES[tone]} ${className ?? ''}`} {...rest} />;
}
