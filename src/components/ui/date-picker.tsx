import * as React from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { FadeModal } from '@/components/ui/fade-modal';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type Anchor = { left: number; top: number; width: number; height: number };

function parseDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateLabel(value: string | null) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : 'No due date';
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function menuPosition(anchor: Anchor) {
  const window = Dimensions.get('window');
  const width = Math.min(296, window.width - 24);
  const left = Math.min(Math.max(12, anchor.left), window.width - width - 12);
  const below = anchor.top + anchor.height + 4;
  const height = 354;
  const top = below + height > window.height - 12
    ? Math.max(12, anchor.top - height - 4)
    : below;
  return { left, top, width };
}

export function DatePicker({
  value,
  onChange,
  className,
  compact = false,
  onOpenChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  compact?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  const [month, setMonth] = React.useState(() => parseDate(value) ?? new Date());
  const [hovered, setHovered] = React.useState(false);
  const triggerRef = React.useRef<View>(null);
  const selected = parseDate(value);

  const openPicker = () =>
    triggerRef.current?.measureInWindow((left, top, width, height) => {
      setMonth(parseDate(value) ?? new Date());
      setAnchor({ left, top, width, height });
      setOpen(true);
      onOpenChange?.(true);
    });
  const closePicker = () => {
    setOpen(false);
    onOpenChange?.(false);
  };

  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable
        onPress={openPicker}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        className={cn(
          'h-10 flex-row items-center gap-2 rounded-md border border-input bg-background px-3 active:bg-accent',
          className,
          hovered && 'bg-accent'
        )}
      >
        {!compact ? <Icon as={CalendarDays} size={16} className="text-muted-foreground" /> : null}
        <Text className={cn('flex-1 text-sm font-medium', !value && 'text-muted-foreground')}>
          {dateLabel(value)}
        </Text>
      </Pressable>

      {anchor ? (
        <FadeModal
          visible={open}
          onRequestClose={closePicker}
          onDismiss={() => setAnchor(null)}
        >
          <View className="flex-1">
            <Pressable
              className="absolute inset-0 cursor-default"
              onPress={closePicker}
            />
            <View
              className="absolute gap-3 rounded-md border border-border bg-popover p-3"
              style={menuPosition(anchor)}
            >
              <View className="flex-row items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  icon={ChevronLeft}
                  accessibilityLabel="Previous month"
                  onPress={() =>
                    setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                  }
                />
                <Text className="text-sm font-semibold">
                  {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
                <Button
                  variant="ghost"
                  size="icon"
                  icon={ChevronRight}
                  accessibilityLabel="Next month"
                  onPress={() =>
                    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                  }
                />
              </View>

              <View className="flex-row">
                {WEEKDAYS.map((day) => (
                  <View key={day} className="h-7 flex-1 items-center justify-center">
                    <Text variant="small" className="font-semibold text-muted-foreground">
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="flex-row flex-wrap">
                {calendarDays(month).map((date) => {
                  const dateString = dateValue(date);
                  const isSelected = selected ? dateValue(selected) === dateString : false;
                  const inMonth = date.getMonth() === month.getMonth();
                  const isToday = dateValue(new Date()) === dateString;
                  return (
                    <Pressable
                      key={dateString}
                      onPress={() => {
                        onChange(dateString);
                        closePicker();
                      }}
                      className={cn(
                        'h-9 w-[14.2857%] items-center justify-center rounded-sm hover:bg-accent',
                        isSelected ? 'bg-primary' : 'active:bg-accent'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm',
                          !inMonth && 'text-muted-foreground opacity-50',
                          isToday && !isSelected && 'font-bold text-primary',
                          isSelected && 'font-semibold text-primary-foreground'
                        )}
                      >
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row justify-end border-t border-border pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  label="Clear"
                  disabled={!value}
                  onPress={() => {
                    onChange(null);
                    closePicker();
                  }}
                />
              </View>
            </View>
          </View>
        </FadeModal>
      ) : null}
    </View>
  );
}
