import * as React from 'react';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { FadeModal } from '@/components/ui/fade-modal';

export type SelectOption<T extends string> = { value: T; label: string };

function Trigger({
  label,
  placeholder,
  onPress,
  className,
  valueContent,
}: {
  label?: string;
  placeholder: string;
  onPress: () => void;
  className?: string;
  valueContent?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'h-11 flex-row items-center gap-2 rounded-lg border border-input bg-background px-3.5 active:bg-accent',
        className
      )}
    >
      {valueContent ? (
        <View className="flex-1">{valueContent}</View>
      ) : (
        <Text className={cn('flex-1 text-sm font-medium', !label && 'text-muted-foreground')} numberOfLines={1}>
          {label || placeholder}
        </Text>
      )}
      <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
    </Pressable>
  );
}

type Anchor = { left: number; top: number; width: number; height: number };

function getMenuFrame(anchor: Anchor) {
  const window = Dimensions.get('window');
  const maxHeight = Math.min(320, window.height - 24);
  const width = Math.min(Math.max(anchor.width, 192), window.width - 24);
  const left = Math.min(Math.max(12, anchor.left), window.width - width - 12);
  const below = anchor.top + anchor.height + 4;
  const top = below + maxHeight > window.height - 12
    ? Math.max(12, anchor.top - maxHeight - 4)
    : below;

  return { left, top, width, maxHeight };
}

/** Anchored dropdown shared by both selects: tap-away backdrop over a scrollable list. */
function OptionDropdown<T extends string>({
  options,
  isActive,
  onPick,
  onClose,
  onDismiss,
  anchor,
  visible,
  multiple,
}: {
  options: SelectOption<T>[];
  isActive: (value: T) => boolean;
  onPick: (value: T) => void;
  onClose: () => void;
  onDismiss: () => void;
  anchor: Anchor;
  visible: boolean;
  multiple?: boolean;
}) {
  const frame = getMenuFrame(anchor);

  return (
    <FadeModal visible={visible} onRequestClose={onClose} onDismiss={onDismiss}>
      <View className="flex-1">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View
          className="absolute overflow-hidden rounded-md border border-border bg-popover"
          style={{ left: frame.left, top: frame.top, width: frame.width }}
        >
          <ScrollView style={{ maxHeight: frame.maxHeight }}>
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
      </View>
    </FadeModal>
  );
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  className,
  renderValue,
}: {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  renderValue?: (option: SelectOption<T>) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  const triggerRef = React.useRef<View>(null);
  const current = options.find((o) => o.value === value);
  const openDropdown = () =>
    triggerRef.current?.measureInWindow((left, top, width, height) => {
      setAnchor({ left, top, width, height });
      setOpen(true);
    });

  return (
    <View ref={triggerRef} collapsable={false}>
      <Trigger
        label={current?.label}
        placeholder={placeholder}
        onPress={openDropdown}
        className={className}
        valueContent={current && renderValue ? renderValue(current) : undefined}
      />
      {anchor ? (
        <OptionDropdown
          visible={open}
          options={options}
          isActive={(v) => v === value}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          onDismiss={() => setAnchor(null)}
          anchor={anchor}
        />
      ) : null}
    </View>
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
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  const triggerRef = React.useRef<View>(null);
  const label = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label)
    .join(', ');
  const openDropdown = () =>
    triggerRef.current?.measureInWindow((left, top, width, height) => {
      setAnchor({ left, top, width, height });
      setOpen(true);
    });

  return (
    <View ref={triggerRef} collapsable={false}>
      <Trigger label={label} placeholder={placeholder} onPress={openDropdown} className={className} />
      {anchor ? (
        <OptionDropdown
          multiple
          visible={open}
          options={options}
          isActive={(v) => values.includes(v)}
          onPick={(v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])}
          onClose={() => setOpen(false)}
          onDismiss={() => setAnchor(null)}
          anchor={anchor}
        />
      ) : null}
    </View>
  );
}
