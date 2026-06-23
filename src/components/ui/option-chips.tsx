import { Pressable, View } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

export type ChipOption<T extends string> = { value: T; label: string };

/** Single-select pill group used for statuses, priorities, etc. */
export function OptionChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={cn(
              'rounded-full border px-3 py-1.5',
              active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
            )}
          >
            <Text className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
