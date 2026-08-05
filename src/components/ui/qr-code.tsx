import * as React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { qrPath } from '@/lib/qr';
import { cn } from '@/lib/utils';

/** Always dark-on-white, in both themes — inverted codes scan unreliably. */
export function QrCode({
  value,
  size = 160,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const { path, size: units } = React.useMemo(() => qrPath(value), [value]);
  return (
    <View className={cn('bg-white', className)} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${units} ${units}`}>
        <Path d={path} fill="#000000" />
      </Svg>
    </View>
  );
}
