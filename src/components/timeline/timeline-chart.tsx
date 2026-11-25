import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  dayOffset,
  itemDateLabel,
  timelineHeader,
  weekdayIndex,
  type TimelineGroup,
  type TimelineItem,
  type TimelineModel,
  type TimelineZoom,
} from '@/lib/timeline';
import type { TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const BAND_HEIGHT = 26;
const TICK_HEIGHT = 24;
const HEADER_HEIGHT = BAND_HEIGHT + TICK_HEIGHT;
const PROJECT_ROW = 40;
const TASK_ROW = 44;
const BAR_HEIGHT = 24;
/** Bars narrower than this put their title beside them instead of inside. */
const MIN_INSIDE_LABEL = 96;

export const STATUS_BAR: Record<TaskStatus, { bar: string; text: string; label: string }> = {
  todo: { bar: 'border border-primary/70 bg-primary/25', text: 'text-foreground', label: 'To do' },
  in_progress: { bar: 'bg-primary', text: 'text-primary-foreground', label: 'In progress' },
  blocked: { bar: 'bg-warning', text: 'text-warning-foreground', label: 'Blocked' },
  done: { bar: 'bg-success/70', text: 'text-success-foreground', label: 'Done' },
};

type Row =
  | { key: string; kind: 'project'; group: TimelineGroup; collapsed: boolean }
  | { key: string; kind: 'task'; group: TimelineGroup; item: TimelineItem };

function rowsFor(groups: TimelineGroup[], collapsed: Set<string>): Row[] {
  const rows: Row[] = [];
  for (const group of groups) {
    const isCollapsed = collapsed.has(group.project.id);
    rows.push({ key: `p:${group.project.id}`, kind: 'project', group, collapsed: isCollapsed });
    if (isCollapsed) continue;
    for (const item of group.items) rows.push({ key: `t:${item.id}`, kind: 'task', group, item });
  }
  return rows;
}

const rowHeight = (row: Row) => (row.kind === 'project' ? PROJECT_ROW : TASK_ROW);

function projectCaption(group: TimelineGroup): string {
  const scheduled = group.items.length;
  const parts = [`${scheduled} ${scheduled === 1 ? 'task' : 'tasks'}`];
  if (group.unscheduled > 0) parts.push(`${group.unscheduled} without dates`);
  return parts.join(' · ');
}

export type TimelineChartHandle = { scrollToToday: (animated?: boolean) => void };

export function TimelineChart({
  model,
  zoom,
  dayWidth,
  labelWidth,
  onOpenTask,
  onOpenProject,
  ref,
}: {
  model: TimelineModel;
  zoom: TimelineZoom;
  dayWidth: number;
  labelWidth: number;
  onOpenTask: (item: TimelineItem) => void;
  onOpenProject: (projectId: string) => void;
  ref?: React.Ref<TimelineChartHandle>;
}) {
  const { range, today } = model;
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [viewport, setViewport] = React.useState(0);
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  // The month labels follow the scroll position; only that row re-renders.
  const bandScroll = React.useRef<((x: number) => void) | null>(null);

  const rows = rowsFor(model.groups, collapsed);
  const header = timelineHeader(range, zoom);
  const days = range.end - range.start + 1;
  const width = days * dayWidth;
  const tops: number[] = [];
  let bodyHeight = 0;
  for (const row of rows) {
    tops.push(bodyHeight);
    bodyHeight += rowHeight(row);
  }
  const todayLeft = dayOffset(today, range, dayWidth);

  const scrollToToday = React.useCallback(
    (animated = true) => {
      if (!viewport) return;
      // Leave a quarter of the view for what just happened.
      const x = Math.max(0, Math.min(todayLeft - viewport / 4, width - viewport));
      scrollRef.current?.scrollTo({ x, animated });
    },
    [todayLeft, viewport, width]
  );
  React.useImperativeHandle(ref, () => ({ scrollToToday }), [scrollToToday]);

  // Open on today, and again whenever a zoom change moves everything.
  React.useEffect(() => {
    scrollToToday(false);
  }, [scrollToToday, zoom, range.start]);

  const toggle = (projectId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });

  // Grid lines: a line at each week (or month, when zoomed out), and shaded
  // weekends when each day is wide enough to see them.
  const gridLines: { left: number; strong: boolean }[] = [];
  const weekends: { left: number }[] = [];
  for (let day = range.start; day <= range.end; day += 1) {
    const monday = weekdayIndex(day) === 0;
    if (zoom === 'quarters') {
      if (header.ticks.some((tick) => tick.day === day)) gridLines.push({ left: dayOffset(day, range, dayWidth), strong: true });
    } else if (monday) {
      gridLines.push({ left: dayOffset(day, range, dayWidth), strong: zoom === 'weeks' });
    }
    if (zoom === 'weeks' && weekdayIndex(day) === 5) weekends.push({ left: dayOffset(day, range, dayWidth) });
  }

  return (
    <View className="flex-row overflow-hidden rounded-md border border-border bg-card">
      {/* Fixed label column */}
      <View style={{ width: labelWidth }} className="border-r border-border">
        <View style={{ height: HEADER_HEIGHT }} className="justify-end border-b border-border px-3 pb-1.5">
          <Text variant="small" className="font-semibold uppercase tracking-wider text-muted-foreground">
            Work
          </Text>
        </View>
        {rows.map((row) =>
          row.kind === 'project' ? (
            <View key={row.key} style={{ height: PROJECT_ROW }} className="flex-row items-center border-b border-border bg-muted/50">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${row.collapsed ? 'Expand' : 'Collapse'} ${row.group.project.name}`}
                onPress={() => toggle(row.group.project.id)}
                className="h-full w-8 items-center justify-center active:opacity-60"
              >
                <Icon as={row.collapsed ? ChevronRight : ChevronDown} size={16} className="text-muted-foreground" />
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => onOpenProject(row.group.project.id)}
                className="min-w-0 flex-1 pr-3 active:opacity-70"
              >
                <Text numberOfLines={1} className="text-sm font-bold">
                  {row.group.project.name}
                </Text>
                <Text numberOfLines={1} variant="small" className="text-[11px]">
                  {projectCaption(row.group)}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              key={row.key}
              accessibilityRole="link"
              onPress={() => onOpenTask(row.item)}
              style={{ height: TASK_ROW }}
              className="justify-center border-b border-border pl-8 pr-3 hover:bg-accent/60 active:bg-accent"
            >
              <Text
                numberOfLines={1}
                className={cn('text-sm', row.item.status === 'done' && 'text-muted-foreground line-through')}
              >
                {row.item.title}
              </Text>
              <Text
                numberOfLines={1}
                variant="small"
                className={cn('text-[11px]', row.item.overdue && 'font-semibold text-destructive')}
              >
                {itemDateLabel(row.item, today)}
                {row.item.overdue ? ' · overdue' : ''}
              </Text>
            </Pressable>
          )
        )}
      </View>

      {/* Scrolling chart */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        onScroll={(event) => bandScroll.current?.(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        className="flex-1"
      >
        <View style={{ width }}>
          {/* Header */}
          <View style={{ height: HEADER_HEIGHT }} className="border-b border-border">
            <BandRow
              bands={header.top}
              range={range}
              dayWidth={dayWidth}
              register={(setter) => {
                bandScroll.current = setter;
              }}
            />
            <View style={{ height: TICK_HEIGHT }}>
              {header.ticks.map((tick) => (
                <View
                  key={tick.day}
                  style={{
                    position: 'absolute',
                    left: dayOffset(tick.day, range, dayWidth),
                    width: zoom === 'weeks' ? dayWidth : undefined,
                    height: TICK_HEIGHT,
                  }}
                  className={cn('justify-center', zoom === 'weeks' ? 'items-center' : 'pl-1')}
                >
                  <Text
                    className={cn(
                      'text-[11px] tabular-nums',
                      tick.day === today
                        ? 'font-bold text-primary'
                        : tick.weekend
                          ? 'text-muted-foreground/70'
                          : 'text-muted-foreground'
                    )}
                  >
                    {tick.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Body */}
          <View style={{ height: bodyHeight }}>
            {weekends.map((weekend) => (
              <View
                key={`we${weekend.left}`}
                style={{ position: 'absolute', left: weekend.left, width: dayWidth * 2, top: 0, bottom: 0, pointerEvents: 'none' }}
                className="bg-muted/60"
              />
            ))}
            {gridLines.map((line) => (
              <View
                key={`gl${line.left}`}
                style={{ position: 'absolute', left: line.left, width: 1, top: 0, bottom: 0, pointerEvents: 'none' }}
                className={line.strong ? 'bg-border' : 'bg-border/60'}
              />
            ))}

            {rows.map((row, index) => {
              const top = tops[index];
              return row.kind === 'project' ? (
                <ProjectSpan key={row.key} group={row.group} top={top} dayWidth={dayWidth} range={range} />
              ) : (
                <TaskBar
                  key={row.key}
                  item={row.item}
                  top={top}
                  dayWidth={dayWidth}
                  range={range}
                  today={today}
                  chartWidth={width}
                  onPress={() => onOpenTask(row.item)}
                />
              );
            })}

            {/* Row separators drawn over the grid */}
            {rows.map((row, index) => {
              const bottom = tops[index] + rowHeight(row);
              return (
                <View
                  key={`sep${row.key}`}
                  style={{ position: 'absolute', left: 0, right: 0, top: bottom - 1, height: 1, pointerEvents: 'none' }}
                  className="bg-border"
                />
              );
            })}

            {today >= range.start && today <= range.end ? (
              <View
                style={{ position: 'absolute', left: todayLeft + dayWidth / 2 - 1, width: 2, top: 0, bottom: 0, pointerEvents: 'none' }}
                className="bg-destructive/80"
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Room kept for a month label ("September 2027") before it stops following the scroll. */
const BAND_LABEL_WIDTH = 130;

/**
 * Month (or year) labels that stay at the left edge of the view while their
 * band is on screen, so a phone showing five days still says which month.
 */
function BandRow({
  bands,
  range,
  dayWidth,
  register,
}: {
  bands: { start: number; end: number; label: string }[];
  range: { start: number; end: number };
  dayWidth: number;
  register: (setter: (x: number) => void) => void;
}) {
  const [scrollX, setScrollX] = React.useState(0);
  React.useEffect(() => {
    register(setScrollX);
  }, [register]);

  return (
    <View style={{ height: BAND_HEIGHT }}>
      {bands.map((band) => {
        const left = dayOffset(band.start, range, dayWidth);
        const width = (band.end - band.start + 1) * dayWidth;
        const shift = Math.max(0, Math.min(scrollX - left, width - BAND_LABEL_WIDTH));
        return (
          <View
            key={band.start}
            style={{ position: 'absolute', left, width, height: BAND_HEIGHT }}
            className="justify-center overflow-hidden border-l border-border px-2"
          >
            <Text numberOfLines={1} style={{ marginLeft: shift }} className="text-xs font-semibold">
              {band.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ProjectSpan({
  group,
  top,
  dayWidth,
  range,
}: {
  group: TimelineGroup;
  top: number;
  dayWidth: number;
  range: { start: number; end: number };
}) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top, height: PROJECT_ROW, pointerEvents: 'none' }} className="bg-muted/40">
      {group.span ? (
        <View
          style={{
            position: 'absolute',
            left: dayOffset(group.span.start, range, dayWidth),
            width: Math.max(dayWidth, (group.span.end - group.span.start + 1) * dayWidth),
            top: PROJECT_ROW / 2 - 4,
            height: 8,
          }}
          className="rounded-sm bg-foreground/35"
        />
      ) : null}
    </View>
  );
}

function TaskBar({
  item,
  top,
  dayWidth,
  range,
  today,
  chartWidth,
  onPress,
}: {
  item: TimelineItem;
  top: number;
  dayWidth: number;
  range: { start: number; end: number };
  today: number;
  chartWidth: number;
  onPress: () => void;
}) {
  const style = STATUS_BAR[item.status];
  const left = dayOffset(item.start, range, dayWidth);
  const barWidth = (item.end - item.start + 1) * dayWidth;
  const label = `${item.title}, ${itemDateLabel(item, today)}, ${style.label}${item.overdue ? ', overdue' : ''}`;

  if (item.kind === 'milestone') {
    const size = 14;
    const center = left + dayWidth / 2;
    const textLeft = center + size;
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onPress={onPress}
        style={{ position: 'absolute', left: center - size, top, height: TASK_ROW, width: size * 2 }}
        className="items-center justify-center active:opacity-70"
      >
        <View
          style={{ width: size, height: size, transform: [{ rotate: '45deg' }] }}
          className={cn(
            'rounded-[2px]',
            item.status === 'done' ? 'bg-success' : item.overdue ? 'bg-destructive' : 'bg-primary',
            item.status === 'blocked' && !item.overdue && 'bg-warning'
          )}
        />
        {textLeft + 40 < chartWidth ? (
          <View style={{ position: 'absolute', left: size * 2 + 2, width: 220, pointerEvents: 'none' }}>
            <Text numberOfLines={1} className="text-xs text-foreground">
              {item.title}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  const inside = barWidth >= MIN_INSIDE_LABEL;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ position: 'absolute', left, top: top + (TASK_ROW - BAR_HEIGHT) / 2, height: BAR_HEIGHT, width: Math.max(barWidth, 6) }}
      className={cn(
        'justify-center rounded-sm px-2 active:opacity-70 hover:opacity-90',
        style.bar,
        item.overdue && 'border-2 border-destructive'
      )}
    >
      {inside ? (
        <Text numberOfLines={1} className={cn('text-xs font-semibold', style.text)}>
          {item.title}
        </Text>
      ) : (
        <View style={{ position: 'absolute', left: Math.max(barWidth, 6) + 6, width: 220, pointerEvents: 'none' }}>
          <Text numberOfLines={1} className="text-xs text-foreground">
            {item.title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
