import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export type SelectOption<T extends string> = { value: T; label: string };

function Trigger({
  label,
  placeholder,
  onPress,
  className,
}: {
  label?: string;
  placeholder: string;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'h-11 flex-row items-center gap-2 rounded-lg border border-input bg-background px-3.5 active:bg-accent',
        className
      )}
    >
      <Text className={cn('flex-1 text-sm font-medium', !label && 'text-muted-foreground')} numberOfLines={1}>
        {label || placeholder}
      </Text>
      <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
    </Pressable>
  );
}

/** Option sheet shared by both selects: tap-away backdrop over a scrollable list. */
function OptionSheet<T extends string>({
  options,
  isActive,
  onPick,
  onClose,
  multiple,
}: {
  options: SelectOption<T>[];
  isActive: (value: T) => boolean;
  onPick: (value: T) => void;
  onClose: () => void;
  multiple?: boolean;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-center bg-black/50 p-6" onPress={onClose}>
        <View className="w-full max-w-sm self-center overflow-hidden rounded-md border border-border bg-popover">
          <ScrollView className="max-h-80">
            {options.map((o) => {
              const active = isActive(o.value);
              return (
                <Pressable
                  key={o.value}
                  onPress={() => onPick(o.value)}
                  className={cn('flex-row items-center gap-2 px-3.5 py-2.5', active ? 'bg-accent' : 'active:bg-accent')}
                >
                  <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
                    {o.label}
                  </Text>
                  {active ? <Icon as={Check} size={16} className="text-primary" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {multiple ? (
            <Pressable onPress={onClose} className="border-t border-border py-2.5 active:bg-accent">
              <Text className="text-center text-sm font-semibold text-primary">Done</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  className,
}: {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Trigger label={current?.label} placeholder={placeholder} onPress={() => setOpen(true)} className={className} />
      {open ? (
        <OptionSheet
          options={options}
          isActive={(v) => v === value}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function MultiSelect<T extends string>({
  options,
  values,
  onChange,
  placeholder = 'Select…',
  className,
}: {
  options: SelectOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const label = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label)
    .join(', ');

  return (
    <>
      <Trigger label={label} placeholder={placeholder} onPress={() => setOpen(true)} className={className} />
      {open ? (
        <OptionSheet
          multiple
          options={options}
          isActive={(v) => values.includes(v)}
          onPick={(v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
