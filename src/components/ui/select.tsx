import * as React from 'react';
import { Dimensions, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
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
  const [hovered, setHovered] = React.useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className={cn(
        'h-11 flex-row items-center gap-2 rounded-lg border border-input bg-background px-3.5 active:bg-accent',
        className,
        hovered && 'bg-accent'
      )}
    >
      {valueContent ? (
        <View className="flex-1">{valueContent}</View>
      ) : (
        <Text className={cn('flex-1 text-sm font-medium', !label && 'text-muted-foreground')} numberOfLines={1}>
          {label || placeholder}
        </Text>
      )}
    </Pressable>
  );
}

type Anchor = { left: number; top: number; width: number; height: number };

function getMenuFrame(anchor: Anchor) {
  const window = Dimensions.get('window');
  const width = Math.min(Math.max(anchor.width, 240), window.width - 24);
  const left = Math.min(Math.max(12, anchor.left), window.width - width - 12);
  const top = Math.max(12, Math.min(anchor.top, window.height - 212));
  const maxHeight = Math.min(360, window.height - top - 12);

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
  renderOption,
  selectedOptions,
  onRemove,
  renderSelectedOption,
}: {
  options: SelectOption<T>[];
  isActive: (value: T) => boolean;
  onPick: (value: T) => void;
  onClose: () => void;
  onDismiss: () => void;
  anchor: Anchor;
  visible: boolean;
  multiple?: boolean;
  renderOption?: (option: SelectOption<T>) => React.ReactNode;
  selectedOptions: SelectOption<T>[];
  onRemove?: (value: T) => void;
  renderSelectedOption?: (option: SelectOption<T>) => React.ReactNode;
}) {
  const frame = getMenuFrame(anchor);
  const [query, setQuery] = React.useState('');
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  const removeLast = () => {
    if (query || !onRemove || selectedOptions.length === 0) return;
    onRemove(selectedOptions[selectedOptions.length - 1].value);
  };

  return (
    <FadeModal visible={visible} onRequestClose={onClose} onDismiss={onDismiss}>
      <View className="flex-1">
        <Pressable className="absolute inset-0 cursor-default" onPress={onClose} />
        <View
          className="absolute overflow-hidden rounded-md border border-border bg-popover"
          style={{ left: frame.left, top: frame.top, width: frame.width, maxHeight: frame.maxHeight }}
        >
          <View
            className="min-h-11 flex-row flex-wrap items-center gap-1.5 border-b border-border px-2 py-2"
            style={{ minHeight: anchor.height }}
          >
            {selectedOptions.map((option) => (
              <View
                key={option.value}
                className={cn(
                  'flex-row items-center gap-1 rounded-sm',
                  onRemove && 'bg-muted px-1.5 py-1'
                )}
              >
                {renderSelectedOption ? (
                  renderSelectedOption(option)
                ) : renderOption ? (
                  renderOption(option)
                ) : (
                  <Text className="text-sm font-medium">{option.label}</Text>
                )}
                {onRemove ? (
                  <Pressable
                    accessibilityLabel={`Remove ${option.label}`}
                    onPress={() => onRemove(option.value)}
                    className="rounded-sm p-0.5 active:bg-accent"
                  >
                    <Icon as={X} size={13} className="text-muted-foreground" />
                  </Pressable>
                ) : null}
              </View>
            ))}
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              onKeyPress={(event) => {
                if (event.nativeEvent.key === 'Backspace') removeLast();
              }}
              onSubmitEditing={() => {
                if (!query.trim()) {
                  onClose();
                  return;
                }
                const firstOption = filteredOptions[0];
                if (!firstOption) return;
                onPick(firstOption.value);
                setQuery('');
              }}
              blurOnSubmit={false}
              placeholder={selectedOptions.length > 0 ? '' : 'Search...'}
              placeholderTextColor="hsl(215 16% 47%)"
              className="h-8 min-w-16 flex-1 bg-transparent px-1 text-sm text-foreground outline-none"
            />
          </View>

          {multiple ? (
            <View className="px-3 pb-1 pt-2.5">
              <Text className="text-xs text-muted-foreground">Select as many as you like</Text>
            </View>
          ) : null}

          <ScrollView style={{ maxHeight: frame.maxHeight - anchor.height - (multiple ? 36 : 0) }}>
            {filteredOptions.map((o) => {
              const active = isActive(o.value);
              return (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    onPick(o.value);
                    setQuery('');
                  }}
                  className={cn(
                    'flex-row items-center gap-2 px-3.5 py-2.5 hover:bg-accent',
                    active ? 'bg-accent' : 'active:bg-accent'
                  )}
                >
                  <View className="flex-1">
                    {renderOption ? (
                      renderOption(o)
                    ) : (
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {o.label}
                      </Text>
                    )}
                  </View>
                  {active ? <Icon as={Check} size={16} className="text-primary" /> : null}
                </Pressable>
              );
            })}
            {filteredOptions.length === 0 ? (
              <View className="px-3.5 py-4">
                <Text className="text-sm text-muted-foreground">No matches</Text>
              </View>
            ) : null}
          </ScrollView>
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
          renderOption={renderValue}
          selectedOptions={current ? [current] : []}
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
  renderValue,
  renderOption,
  renderSelectedOption,
}: {
  options: SelectOption<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  placeholder?: string;
  className?: string;
  renderValue?: (options: SelectOption<T>[]) => React.ReactNode;
  renderOption?: (option: SelectOption<T>) => React.ReactNode;
  renderSelectedOption?: (option: SelectOption<T>) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  const triggerRef = React.useRef<View>(null);
  const label = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label)
    .join(', ');
  const selectedOptions = options.filter((o) => values.includes(o.value));
  const openDropdown = () =>
    triggerRef.current?.measureInWindow((left, top, width, height) => {
      setAnchor({ left, top, width, height });
      setOpen(true);
    });

  return (
    <View ref={triggerRef} collapsable={false}>
      <Trigger
        label={label}
        placeholder={placeholder}
        onPress={openDropdown}
        className={className}
        valueContent={
          selectedOptions.length > 0 && renderValue
            ? renderValue(selectedOptions)
            : undefined
        }
      />
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
          renderOption={renderOption}
          selectedOptions={selectedOptions}
          onRemove={(value) => {
            onChange(values.filter((item) => item !== value));
          }}
          renderSelectedOption={renderSelectedOption}
        />
      ) : null}
    </View>
  );
}
