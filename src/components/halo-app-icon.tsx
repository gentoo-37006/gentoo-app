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

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={source}
        contentFit="cover"
        pointerEvents="none"
        accessibilityLabel="Gentoo app icon"
        style={{ position: 'absolute', width: haloSize, height: haloSize }}
      />
    </View>
  );
}
