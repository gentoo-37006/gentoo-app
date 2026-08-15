import { View } from 'react-native';
import { Image } from 'expo-image';
import { useColorScheme } from 'nativewind';

export function HaloAppIcon({ size }: { size: number }) {
  const { colorScheme } = useColorScheme();
  const haloSize = size * 4;
  const source =
    colorScheme === 'dark'
      ? require('../../assets/images/splash-icon-dark.png')
      : require('../../assets/images/splash-icon-light.png');

  // pointerEvents lives on this wrapper, not the Image: expo-image's style is an
  // ImageStyle, which has no pointerEvents. 'none' covers subviews too, and the
  // halo is the only child, so the effect is identical.
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <Image
        source={source}
        contentFit="cover"
        accessibilityLabel="Gentoo app icon"
        style={{ position: 'absolute', width: haloSize, height: haloSize }}
      />
    </View>
  );
}
