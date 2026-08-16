import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import {
  ListChecks,
  FolderKanban,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Timer,
  ChevronRight,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useProjects, useMyTasks, useMyOpenTaskCount, type MyTask } from '@/lib/queries/tasks';
import { useMyOpenCheckoutCount, useParts } from '@/lib/queries/inventory';
import { useMatches } from '@/lib/queries/matches';
import { usePitShifts } from '@/lib/queries/schedule';
import { useTalkieRequests } from '@/lib/queries/talkie';
import { priorityVariant, taskStatusVariant, labelOf } from '@/lib/task-style';
import {
  PRIORITIES,
  TASK_STATUSES,
  checkedOutQuantity,
  isLowStock,
  matchTitle,
} from '@/lib/types';
import { formatDate, formatDayLabel, formatTime, isPastDue, timeUntil } from '@/lib/format';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useNow } from '@/lib/use-now';

/**
 * How many assigned tasks to pull. The list only shows a handful, but the
 * overdue tally is counted from this same result — and because the query sorts
 * soonest-due first, a short limit would silently under-report a big backlog.
 */
const MY_TASK_FETCH_LIMIT = 25;
const MY_TASK_VISIBLE = 5;

type Stat = { label: string; value: string; icon: LucideIcon; tint: string };

function StatCard({ stat }: { stat: Stat }) {
  return (
    <Card className="min-w-[150px] flex-1">
      <CardContent className="gap-2 p-4">
        <Icon as={stat.icon} size={22} className={stat.tint} />
        <Text className="text-2xl font-extrabold">{stat.value}</Text>
        <Text variant="muted">{stat.label}</Text>
      </CardContent>
    </Card>
  );
}

/** One "something needs you" line: icon, what it is, and where to go fix it. */
function AttentionRow({
  icon,
  tint,
  title,
  detail,
  href,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href as any} asChild>
      <Pressable className="rounded-md border border-border bg-card active:opacity-75 hover:bg-accent/70">
        <View className="flex-row items-center gap-3 p-4">
          <Icon as={icon} size={20} className={tint} />
          <View className="flex-1 gap-0.5">
            <Text className="font-semibold" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="small" numberOfLines={1}>
              {detail}
            </Text>
          </View>
          <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
        </View>
      </Pressable>
    </Link>
  );
}

function MyTaskRow({ task, now }: { task: MyTask; now: number }) {
  const overdue = isPastDue(task.due_date, now);
  // Three badges plus a chevron squeeze the title down to a few characters on a
  // phone. Priority is the one that can wait for the task itself, so it drops
  // first; "Overdue" never does, since that is the reason to look at the row.
  const { isPhone } = useBreakpoint();
  return (
    <Link href={`/projects/${task.project_id}` as any} asChild>
      <Pressable className="rounded-md border border-border bg-card active:opacity-75 hover:bg-accent/70">
        <View className="flex-row items-center gap-3 p-4">
          <View className="flex-1 gap-0.5">
            <Text className="font-semibold" numberOfLines={1}>
              {task.title}
            </Text>
            <Text variant="small" numberOfLines={1}>
              {task.project?.name ?? 'Project'}
              {task.due_date ? ` · due ${formatDate(task.due_date)}` : ''}
            </Text>
          </View>
          {overdue ? (
            <Badge className="self-center" variant="destructive" label="Overdue" />
          ) : null}
          <Badge
            className="self-center"
            variant={taskStatusVariant(task.status)}
            label={labelOf(TASK_STATUSES, task.status)}
          />
          {isPhone ? null : (
            <Badge
              className="self-center"
              variant={priorityVariant(task.priority)}
              label={labelOf(PRIORITIES, task.priority)}
            />
          )}
          <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
        </View>
      </Pressable>
    </Link>
  );
}

/** Compact event strip. The full countdown lives on /competition. */
function UpNextCard({
  icon,
  label,
  headline,
  detail,
  lead,
  href,
}: {
  icon: LucideIcon;
  label: string;
  headline: string;
  detail: string;
  lead: string;
  href: string;
}) {
  return (
    <Link href={href as any} asChild>
      <Pressable className="min-w-[220px] flex-1 rounded-md border border-border bg-card active:opacity-75 hover:bg-accent/70">
        <View className="gap-2 p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={icon} size={16} className="text-primary" />
            <Text variant="label" className="text-muted-foreground">
              {label}
            </Text>
          </View>
          <View className="flex-row items-baseline gap-2">
            <Text className="text-lg font-extrabold" numberOfLines={1}>
              {headline}
            </Text>
            <Text className="font-bold tabular-nums text-primary">{lead}</Text>
          </View>
          <Text variant="small" numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function DashboardScreen() {
  const { profile, session } = useAuth();
  const uid = session?.user?.id;
  const projects = useProjects();
  const myTasks = useMyTasks(uid, MY_TASK_FETCH_LIMIT);
  const myTaskCount = useMyOpenTaskCount(uid);
  const myCheckoutCount = useMyOpenCheckoutCount(uid);
  const parts = useParts();
  const matches = useMatches();
  const shifts = usePitShifts();
  const talkies = useTalkieRequests();
  const now = useNow();

  const firstName = profile?.full_name?.split(' ')[0];

  const tasks = myTasks.data ?? [];
  const overdue = tasks.filter((t) => isPastDue(t.due_date, now));
  const lowStock = (parts.data ?? []).filter((p) =>
    isLowStock(p, Math.max(0, p.quantity - checkedOutQuantity(p.open)))
  );
  const openTalkies = (talkies.data ?? []).filter((t) => t.status === 'open');

  const nextMatch = (matches.data ?? [])
    .filter((m) => m.scheduled_time && new Date(m.scheduled_time).getTime() > now)
    .sort(
      (a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime()
    )[0];
  const nextShift = (shifts.data ?? [])
    .filter((s) => s.assignee_id === uid && new Date(s.end_time).getTime() > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  const stats: Stat[] = [
    {
      label: 'My open tasks',
      value: myTaskCount.isLoading ? '—' : String(myTaskCount.data ?? 0),
      icon: ListChecks,
      tint: 'text-primary',
    },
    {
      label: 'Overdue',
      value: myTasks.isLoading ? '—' : String(overdue.length),
      icon: AlertTriangle,
      // Only paint it red when it is actually a problem, so a clear board reads
      // as calm instead of alarming.
      tint: overdue.length > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      label: 'Active projects',
      value: projects.isLoading
        ? '—'
        : String((projects.data ?? []).filter((p) => p.status === 'active').length),
      icon: FolderKanban,
      tint: 'text-success',
    },
    {
      label: 'Parts I have out',
      value: myCheckoutCount.isLoading ? '—' : String(myCheckoutCount.data ?? 0),
      icon: Boxes,
      tint: 'text-warning',
    },
  ];

  // Nothing here is worth a section header until at least one query has landed;
  // rendering "All clear" while the data is still loading would be a lie.
  const attentionLoading = myTasks.isLoading || parts.isLoading || talkies.isLoading;
  const hasAttention =
    overdue.length > 0 || lowStock.length > 0 || openTalkies.length > 0;
  // The event strip is competition-only. Off-season there is no schedule and no
  // shift, and an empty "Up next" would just be scaffolding on every launch.
  const hasUpNext = Boolean(nextMatch || nextShift);

  return (
    <Screen>
      <ScreenHeader
        title={firstName ? `Welcome, ${firstName}` : 'Dashboard'}
        description="What needs you right now, across the team."
      />

      <View className="flex-row flex-wrap gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </View>

      {attentionLoading ? null : (
        <View className="gap-3">
          <Text variant="title">Needs attention</Text>
          {!hasAttention ? (
            <Card>
              <CardContent className="items-center gap-1 p-6">
                <Icon as={CheckCircle2} size={22} className="text-success" />
                <Text variant="muted">
                  All clear — nothing overdue, low, or waiting on the pit.
                </Text>
              </CardContent>
            </Card>
          ) : (
            <>
              {overdue.slice(0, 3).map((task) => (
                <AttentionRow
                  key={task.id}
                  icon={AlertTriangle}
                  tint="text-destructive"
                  title={task.title}
                  detail={`${task.project?.name ?? 'Project'} · was due ${formatDate(task.due_date)}`}
                  href={`/projects/${task.project_id}`}
                />
              ))}
              {overdue.length > 3 ? (
                <AttentionRow
                  icon={AlertTriangle}
                  tint="text-destructive"
                  title={`${overdue.length - 3} more overdue`}
                  detail="See everything assigned to you"
                  href="/projects"
                />
              ) : null}
              {lowStock.length > 0 ? (
                <AttentionRow
                  icon={Boxes}
                  tint="text-warning"
                  title={`${lowStock.length} part${lowStock.length === 1 ? '' : 's'} low on stock`}
                  detail={lowStock
                    .slice(0, 3)
                    .map((p) => p.name)
                    .join(', ')}
                  href="/inventory"
                />
              ) : null}
              {openTalkies.length > 0 ? (
                <AttentionRow
                  icon={Radio}
                  tint="text-warning"
                  title={`${openTalkies.length} open talkie request${openTalkies.length === 1 ? '' : 's'}`}
                  detail={`Team ${openTalkies[0].team_number} · ${openTalkies[0].reason}`}
                  href="/talkie"
                />
              ) : null}
            </>
          )}
        </View>
      )}

      {hasUpNext ? (
        <View className="gap-3">
          <Text variant="title">Up next</Text>
          <View className="flex-row flex-wrap gap-3">
            {nextMatch ? (
              <UpNextCard
                icon={Timer}
                label="Next match"
                headline={matchTitle(nextMatch)}
                lead={timeUntil(nextMatch.scheduled_time!, now)}
                detail={`${formatDayLabel(nextMatch.scheduled_time!)} · ${formatTime(nextMatch.scheduled_time!)}`}
                href="/competition"
              />
            ) : null}
            {nextShift ? (
              <UpNextCard
                icon={CalendarClock}
                label="My pit shift"
                headline={`${formatTime(nextShift.start_time)} – ${formatTime(nextShift.end_time)}`}
                lead={timeUntil(nextShift.start_time, now)}
                detail={formatDayLabel(nextShift.start_time)}
                href="/schedule"
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="title">My tasks</Text>
          <Link href={'/projects' as any} asChild>
            <Pressable className="flex-row items-center gap-1 active:opacity-70">
              <Text variant="muted">All projects</Text>
              <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
            </Pressable>
          </Link>
        </View>
        {myTasks.isLoading ? null : tasks.length === 0 ? (
          <Card>
            <CardContent className="items-center gap-1 p-6">
              <Icon as={CalendarClock} size={22} className="text-muted-foreground" />
              <Text variant="muted">Nothing assigned to you — enjoy it while it lasts.</Text>
            </CardContent>
          </Card>
        ) : (
          tasks.slice(0, MY_TASK_VISIBLE).map((t) => <MyTaskRow key={t.id} task={t} now={now} />)
        )}
      </View>
    </Screen>
  );
}
