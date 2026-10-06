import { Image } from 'expo-image';

/** Artemis logo. Replace assets/images/logo/artemis-logo.png to update it. */
export function LogoMark({ size = 144 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo/artemis-logo.png')}
      contentFit="contain"
      accessibilityLabel="Artemis"
      style={{ width: size, height: size }}
    />
  );
}
