import { Pressable, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import {
  ListChecks,
  FolderKanban,
  Cable,
  Download,
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
import { isDesktopApp } from '@/lib/desktop-updates';
import { useProjects, useMyTasks, useMyOpenTaskCount, type MyTask } from '@/lib/queries/tasks';
import { priorityVariant, labelOf } from '@/lib/task-style';
import { PRIORITIES } from '@/lib/types';
import { formatDate } from '@/lib/format';

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

function MyTaskRow({ task }: { task: MyTask }) {
  const overdue = task.due_date ? new Date(task.due_date).getTime() < Date.now() : false;
  return (
    <Link href={`/tasks/${task.project_id}` as any} asChild>
      <Pressable className="active:opacity-75">
        <Card>
          <CardContent className="flex-row items-center gap-3 p-4">
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold" numberOfLines={1}>
                {task.title}
              </Text>
              <Text variant="small" numberOfLines={1}>
                {task.project?.name ?? 'Project'}
                {task.due_date ? ` · due ${formatDate(task.due_date)}` : ''}
              </Text>
            </View>
            {overdue ? <Badge variant="destructive" label="Overdue" /> : null}
            <Badge variant={priorityVariant(task.priority)} label={labelOf(PRIORITIES, task.priority)} />
            <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
          </CardContent>
        </Card>
      </Pressable>
    </Link>
  );
}

type QuickAction = { label: string; description: string; href: string; icon: LucideIcon; hideOnDesktop?: boolean };

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'View tasks', description: 'Projects and to-dos', href: '/tasks', icon: ListChecks },
  { label: 'Count cables', description: 'AI-identify cables from a photo', href: '/cables', icon: Cable },
  { label: 'Downloads', description: 'Install the app on other devices', href: '/downloads', icon: Download, hideOnDesktop: true },
];

function QuickActionCard({ action }: { action: QuickAction }) {
  const router = useRouter();
  return (
    <Pressable
      className="flex-1 basis-full active:opacity-75 md:basis-[48%]"
      onPress={() => router.push(action.href as any)}
    >
      <Card>
        <CardContent className="flex-row items-center gap-4 p-4">
          <View className="h-11 w-11 items-center justify-center rounded-md bg-accent">
            <Icon as={action.icon} size={22} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">{action.label}</Text>
            <Text variant="muted">{action.description}</Text>
          </View>
          <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
        </CardContent>
      </Card>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { profile, session } = useAuth();
  const uid = session?.user?.id;
  const projects = useProjects();
  const myTasks = useMyTasks(uid);
  const myTaskCount = useMyOpenTaskCount(uid);

  const firstName = profile?.full_name?.split(' ')[0];

  const stats: Stat[] = [
    {
      label: 'My open tasks',
      value: myTaskCount.isLoading ? '—' : String(myTaskCount.data ?? 0),
      icon: ListChecks,
      tint: 'text-primary',
    },
    {
      label: 'Active projects',
      value: projects.isLoading ? '—' : String((projects.data ?? []).filter((p) => p.status === 'active').length),
      icon: FolderKanban,
      tint: 'text-success',
    },
  ];

  const actions = QUICK_ACTIONS.filter((a) => !(a.hideOnDesktop && isDesktopApp));

  return (
    <Screen>
      <ScreenHeader
        title={firstName ? `Welcome, ${firstName}` : 'Dashboard'}
        description="Your work across projects and the shop."
      />

      <View className="flex-row flex-wrap gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="title">My tasks</Text>
          <Link href={'/tasks' as any} asChild>
            <Pressable className="flex-row items-center gap-1 active:opacity-70">
              <Text variant="muted">All tasks</Text>
              <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
            </Pressable>
          </Link>
        </View>
        {myTasks.isLoading ? null : (myTasks.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="items-center gap-1 p-6">
              <Icon as={CalendarClock} size={22} className="text-muted-foreground" />
              <Text variant="muted">Nothing assigned to you — enjoy it while it lasts.</Text>
            </CardContent>
          </Card>
        ) : (
          (myTasks.data ?? []).map((t) => <MyTaskRow key={t.id} task={t} />)
        )}
      </View>

      <View className="gap-3">
        <Text variant="title">Quick actions</Text>
        <View className="flex-row flex-wrap gap-3">
          {actions.map((a) => (
            <QuickActionCard key={a.label} action={a} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
