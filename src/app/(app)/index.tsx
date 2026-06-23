import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import {
  ClipboardList,
  Radio,
  ListChecks,
  CalendarClock,
  Users,
  TrendingUp,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

type Stat = { label: string; value: string; icon: LucideIcon; tint: string };

const STATS: Stat[] = [
  { label: 'Teams scouted', value: '—', icon: Users, tint: 'text-primary' },
  { label: 'Pick-list strength', value: '—', icon: TrendingUp, tint: 'text-success' },
  { label: 'Open talkies', value: '—', icon: Radio, tint: 'text-warning' },
  { label: 'My open tasks', value: '—', icon: ListChecks, tint: 'text-destructive' },
];

type QuickAction = { label: string; description: string; href: string; icon: LucideIcon };

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Pit scouting',
    description: 'Log a team’s capabilities',
    href: '/scouting',
    icon: ClipboardList,
  },
  {
    label: 'Raise a talkie',
    description: 'Ask the pit crew for intel',
    href: '/talkie',
    icon: Radio,
  },
  {
    label: 'View tasks',
    description: 'Projects and to-dos',
    href: '/tasks',
    icon: ListChecks,
  },
  {
    label: 'Pit schedule',
    description: 'Who’s staffing the pit',
    href: '/schedule',
    icon: CalendarClock,
  },
];

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

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <Link href={action.href as any} asChild>
      <Pressable className="flex-1 basis-full md:basis-[48%]">
        <Card className="active:opacity-90">
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
    </Link>
  );
}

export default function DashboardScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Dashboard"
        description="Your team’s competition command center."
      />

      <View className="flex-row flex-wrap gap-3">
        {STATS.map((s) => (
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
