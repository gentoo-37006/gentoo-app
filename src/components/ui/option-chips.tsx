import { Pressable, View } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

export type ChipOption<T extends string> = { value: T; label: string };

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-sm border px-3 py-1.5',
        active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
      )}
    >
      <Text className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
        {label}
      </Text>
    </Pressable>
  );
}

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
      {options.map((o) => (
        <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}
