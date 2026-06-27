import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ClipboardList,
  Radio,
  ListChecks,
  CalendarClock,
  Users,
  FolderKanban,
  Cable,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/lib/auth';
import { useTeamScores } from '@/lib/queries/scouting';
import { useTalkieRequests } from '@/lib/queries/talkie';
import { useProjects, useMyOpenTaskCount } from '@/lib/queries/tasks';

type Stat = { label: string; value: string; icon: LucideIcon; tint: string };

function StatCard({ stat }: { stat: Stat }) {
  return (
    <Card className="min-w-[150px] flex-1 basis-[45%] md:basis-[22%]">
      <CardContent className="gap-2 p-4">
        <Icon as={stat.icon} size={22} className={stat.tint} />
        <Text className="text-2xl font-extrabold">{stat.value}</Text>
        <Text variant="muted">{stat.label}</Text>
      </CardContent>
    </Card>
  );
}

type QuickAction = { label: string; description: string; href: string; icon: LucideIcon };

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Pit scouting', description: "Log a team's capabilities", href: '/scouting/pit', icon: ClipboardList },
  { label: 'Raise a talkie', description: 'Ask the pit crew for intel', href: '/talkie', icon: Radio },
  { label: 'View tasks', description: 'Projects and to-dos', href: '/tasks', icon: ListChecks },
  { label: 'Pit schedule', description: "Who's staffing the pit", href: '/schedule', icon: CalendarClock },
  { label: 'Count cables', description: 'AI-identify cables from a photo', href: '/cables', icon: Cable },
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
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-accent">
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
  const teams = useTeamScores();
  const talkies = useTalkieRequests();
  const projects = useProjects();
  const myTasks = useMyOpenTaskCount(session?.user?.id);

  const num = (q: { isLoading: boolean }, value: number) => (q.isLoading ? '—' : String(value));
  const firstName = profile?.full_name?.split(' ')[0];

  const stats: Stat[] = [
    { label: 'Teams scouted', value: num(teams, teams.data?.length ?? 0), icon: Users, tint: 'text-primary' },
    {
      label: 'Open talkies',
      value: num(talkies, (talkies.data ?? []).filter((t) => t.status !== 'resolved').length),
      icon: Radio,
      tint: 'text-warning',
    },
    {
      label: 'My open tasks',
      value: myTasks.isLoading ? '—' : String(myTasks.data ?? 0),
      icon: ListChecks,
      tint: 'text-destructive',
    },
    {
      label: 'Active projects',
      value: num(projects, (projects.data ?? []).filter((p) => p.status === 'active').length),
      icon: FolderKanban,
      tint: 'text-success',
    },
  ];

  return (
    <Screen>
      <ScreenHeader
        title={firstName ? `Welcome, ${firstName}` : 'Dashboard'}
        description="Your team’s competition command center."
      />

      <View className="flex-row flex-wrap gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </View>

      <View className="gap-3">
        <Text variant="title">Quick actions</Text>
        <View className="flex-row flex-wrap gap-3">
          {QUICK_ACTIONS.map((a) => (
            <QuickActionCard key={a.label} action={a} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
