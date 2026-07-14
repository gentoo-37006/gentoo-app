import { View } from 'react-native';
import { cn } from '@/lib/utils';

/** Thin horizontal progress bar for a 0..100 value. */
export function ScoreBar({
  value,
  className,
  fillClassName,
}: {
  value: number;
  className?: string;
  fillClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View className={cn('h-2 w-full overflow-hidden rounded-none bg-muted', className)}>
      <View
        className={cn('h-full rounded-none bg-primary', fillClassName)}
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}
