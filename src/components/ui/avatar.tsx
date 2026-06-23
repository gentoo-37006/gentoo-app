import * as React from 'react';
import { Image, View } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase() || '?';
}

export function Avatar({
  name,
  uri,
  size = 36,
  className,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  const showImage = uri && !errored;

  return (
    <View
      style={{ width: size, height: size }}
      className={cn('items-center justify-center overflow-hidden rounded-full bg-accent', className)}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          onError={() => setErrored(true)}
        />
      ) : (
        <Text style={{ fontSize: size * 0.4 }} className="font-semibold text-foreground">
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
