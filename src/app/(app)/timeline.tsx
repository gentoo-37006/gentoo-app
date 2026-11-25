import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, CalendarClock, CalendarRange, ChartGantt, ChevronRight, Crosshair } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { OptionChips } from '@/components/ui/option-chips';
import { STATUS_BAR, TimelineChart, type TimelineChartHandle } from '@/components/timeline/timeline-chart';
import { useAuth } from '@/lib/auth';
import { useAllTasks, useProjects, type TaskWithProject } from '@/lib/queries/tasks';
import {
  TIMELINE_ZOOMS,
  ZOOM_DAY_WIDTH,
  buildTimeline,
  deadlineSummary,
  localDayNumber,
  relativeDueLabel,
  shortDayLabel,
  upcomingDeadlines,
  type TimelineZoom,
} from '@/lib/timeline';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useNow } from '@/lib/use-now';
import type { TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      className={cn(
        'rounded-sm border px-3 py-1.5',
        active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
      )}
    >
      <Text className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>{label}</Text>
    </Pressable>
  );
}

function SummaryStat({ value, label, tone }: { value: number; label: string; tone?: 'danger' }) {
  return (
    <View className="min-w-[96px] flex-1 gap-0.5 rounded-md border border-border bg-background px-3 py-2">
      <Text className={cn('text-2xl font-extrabold tabular-nums', tone === 'danger' && value > 0 && 'text-destructive')}>
        {value}
      </Text>
      <Text variant="small">{label}</Text>
    </View>
  );
}

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'bg-primary/40',
  in_progress: 'bg-primary',
  blocked: 'bg-warning',
  done: 'bg-success',
};

function ComingUp({
  tasks,
  today,
  assigneeId,
  onOpen,
}: {
  tasks: TaskWithProject[];
  today: number;
  assigneeId: string | null;
  onOpen: (task: TaskWithProject) => void;
}) {
  const deadlines = upcomingDeadlines(tasks, { today, assigneeId });
  const summary = deadlineSummary(deadlines);
  const shown = deadlines.filter((d) => d.daysLeft < 14).slice(0, 8);

  return (
    <Card>
      <CardContent className="gap-4 p-5">
        <View className="flex-row items-center gap-2">
          <Icon as={CalendarClock} size={16} className="text-primary" />
          <Text variant="label" className="text-muted-foreground">
            Coming up
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <SummaryStat value={summary.overdue} label="Overdue" tone="danger" />
          <SummaryStat value={summary.thisWeek} label="Due in 7 days" />
          <SummaryStat value={summary.nextWeek} label="Due the week after" />
        </View>
        {shown.length === 0 ? (
          <Text variant="muted">
            {deadlines.length === 0
              ? 'No open tasks have a due date.'
              : 'Nothing is due in the next two weeks.'}
          </Text>
        ) : (
          <View className="gap-1">
            {shown.map(({ task, due, daysLeft }) => (
              <Pressable
                key={task.id}
                accessibilityRole="link"
                onPress={() => onOpen(task)}
                className="flex-row items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/70 active:bg-accent"
              >
                <View className={cn('h-2.5 w-2.5 rounded-full', STATUS_DOT[task.status])} />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-semibold">
                    {task.title}
                  </Text>
                  <Text numberOfLines={1} variant="small">
                    {task.project?.name ?? 'Project'}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={cn('text-xs font-semibold', daysLeft < 0 ? 'text-destructive' : daysLeft <= 1 ? 'text-warning' : 'text-foreground')}>
                    {relativeDueLabel(daysLeft)}
                  </Text>
                  <Text variant="small" className="text-[11px]">
                    {shortDayLabel(due, today)}
                  </Text>
                </View>
                <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
              </Pressable>
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

function Legend() {
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
      {(Object.keys(STATUS_BAR) as TaskStatus[]).map((status) => (
        <View key={status} className="flex-row items-center gap-1.5">
          <View className={cn('h-3 w-5 rounded-sm', STATUS_BAR[status].bar)} />
          <Text variant="small">{STATUS_BAR[status].label}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-1.5">
        <View style={{ transform: [{ rotate: '45deg' }] }} className="h-2.5 w-2.5 rounded-[1px] bg-primary" />
        <Text variant="small">Due date only</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="h-3 w-5 rounded-sm border-2 border-destructive" />
        <Text variant="small">Overdue</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="h-3 w-0.5 bg-destructive/80" />
        <Text variant="small">Today</Text>
      </View>
    </View>
  );
}

export default function TimelineScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const { isWide } = useBreakpoint();
  const tasks = useAllTasks();
  const projects = useProjects();
  const now = useNow();
  const today = localDayNumber(new Date(now));

  const [zoom, setZoom] = React.useState<TimelineZoom>('weeks');
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [showDone, setShowDone] = React.useState(false);
  const chart = React.useRef<TimelineChartHandle>(null);

  const assigneeId = onlyMine ? uid : null;
  const model = buildTimeline(tasks.data ?? [], projects.data ?? [], { today, hideDone: !showDone, assigneeId });
  const scheduled = model.groups.reduce((sum, group) => sum + group.items.length, 0);
  const openTask = (task: { id: string; project_id?: string; projectId?: string }) =>
    router.push(`/projects/${task.projectId ?? task.project_id}/${task.id}` as any);

  const loading = tasks.isLoading || projects.isLoading;

  return (
    <Screen>
      <ScreenHeader title="Timeline" description="What's coming up across every project, and when it's due.">
        <Button
          variant="outline"
          size="sm"
          label="Today"
          icon={Crosshair}
          accessibilityLabel="Scroll to today"
          disabled={scheduled === 0}
          onPress={() => chart.current?.scrollToToday()}
        />
      </ScreenHeader>

      {loading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : tasks.isError || projects.isError ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load tasks" description="Check your connection and try again.">
          <Button label="Retry" variant="outline" onPress={() => void Promise.all([tasks.refetch(), projects.refetch()])} />
        </EmptyState>
      ) : (
        <>
          <ComingUp tasks={tasks.data ?? []} today={today} assigneeId={assigneeId} onOpen={(task) => openTask(task)} />

          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <OptionChips options={TIMELINE_ZOOMS} value={zoom} onChange={setZoom} />
            <View className="flex-row flex-wrap gap-2">
              <ToggleChip label="Only mine" active={onlyMine} onPress={() => setOnlyMine((v) => !v)} />
              <ToggleChip label="Show done" active={showDone} onPress={() => setShowDone((v) => !v)} />
            </View>
          </View>

          {scheduled === 0 ? (
            <EmptyState
              icon={ChartGantt}
              title="Nothing on the timeline"
              description={
                model.unscheduled > 0
                  ? `${model.unscheduled} ${model.unscheduled === 1 ? 'task has' : 'tasks have'} no dates yet. Give a task a start or due date on its page to place it here.`
                  : onlyMine
                    ? 'No tasks with dates are assigned to you.'
                    : 'Give tasks a start or due date on their pages to see them here.'
              }
            >
              <Button label="Open projects" variant="outline" icon={CalendarRange} onPress={() => router.push('/projects' as any)} />
            </EmptyState>
          ) : (
            <View className="gap-3">
              <TimelineChart
                ref={chart}
                model={model}
                zoom={zoom}
                dayWidth={ZOOM_DAY_WIDTH[zoom]}
                labelWidth={isWide ? 280 : 150}
                onOpenTask={(item) => openTask(item)}
                onOpenProject={(projectId) => router.push(`/projects/${projectId}` as any)}
              />
              <Legend />
              {model.unscheduled > 0 ? (
                <Text variant="small">
                  {model.unscheduled} {model.unscheduled === 1 ? 'task has' : 'tasks have'} no start or due date and
                  {model.unscheduled === 1 ? ' is' : ' are'} not shown.
                </Text>
              ) : null}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
