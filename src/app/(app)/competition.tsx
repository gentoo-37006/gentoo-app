import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import {
  Trophy,
  Timer,
  ClipboardList,
  ListOrdered,
  Radio,
  CalendarClock,
  ChevronRight,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useNow } from '@/lib/use-now';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useMatches, type MatchWithAssignments } from '@/lib/queries/matches';
import { usePitShifts } from '@/lib/queries/schedule';
import { useTalkieRequests, useTalkieRealtime, type TalkieWithPeople } from '@/lib/queries/talkie';
import { useTeamScores } from '@/lib/queries/scouting';
import { matchTitle, matchTeamNumbers, type TalkieStatus } from '@/lib/types';
import { formatTime, formatDayLabel, timeAgo } from '@/lib/format';

/** Re-renders every second while mounted; returns the current epoch ms. */
function countdownParts(ms: number): { label: string; value: string }[] {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0
    ? [
        { label: 'days', value: String(d) },
        { label: 'hrs', value: pad(h) },
        { label: 'min', value: pad(m) },
      ]
    : [
        { label: 'hrs', value: pad(h) },
        { label: 'min', value: pad(m) },
        { label: 'sec', value: pad(s) },
      ];
}

function NextMatchCard({ matches }: { matches: MatchWithAssignments[] }) {
  // 1s ticks: this card renders a live countdown to the next match.
  const now = useNow(1000);
  const upcoming = matches
    .filter((m) => m.scheduled_time && new Date(m.scheduled_time).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime())[0];

  return (
    <Card>
      <CardContent className="gap-4 p-5">
        <View className="flex-row items-center gap-2">
          <Icon as={Timer} size={16} className="text-primary" />
          <Text variant="label" className="text-muted-foreground">
            Next match
          </Text>
        </View>

        {!upcoming ? (
          <Text variant="muted">No upcoming matches scheduled. Import a match schedule to see the countdown.</Text>
        ) : (
          <>
            <View className="flex-row items-end gap-3">
              {countdownParts(new Date(upcoming.scheduled_time!).getTime() - now).map((p) => (
                <View key={p.label} className="items-center rounded-md border border-border bg-background px-3 py-2">
                  <Text className="text-3xl font-extrabold tabular-nums text-primary">{p.value}</Text>
                  <Text variant="small" className="uppercase tracking-wider">
                    {p.label}
                  </Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-bold">{matchTitle(upcoming)}</Text>
              <Text variant="muted">
                {formatDayLabel(upcoming.scheduled_time!)} · {formatTime(upcoming.scheduled_time!)}
              </Text>
            </View>
            {matchTeamNumbers(upcoming).length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {[upcoming.red1, upcoming.red2].filter(Boolean).map((t) => (
                  <Badge key={`r${t}`} variant="destructive" label={String(t)} />
                ))}
                {[upcoming.blue1, upcoming.blue2].filter(Boolean).map((t) => (
                  <Badge key={`b${t}`} variant="default" label={String(t)} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const TALKIE_BADGE: Record<TalkieStatus, 'warning' | 'secondary' | 'success'> = {
  open: 'warning',
  claimed: 'secondary',
  resolved: 'success',
};

function TalkieRow({ talkie }: { talkie: TalkieWithPeople }) {
  return (
    <Link href={'/talkie' as any} asChild>
      <Pressable className="active:opacity-75">
        <Card className="hover:bg-accent/70">
          <CardContent className="flex-row items-center gap-3 p-4">
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold">Team {talkie.team_number}</Text>
              <Text variant="small" numberOfLines={1}>
                {talkie.reason}
              </Text>
            </View>
            <Text variant="small">{timeAgo(talkie.created_at)}</Text>
            <Badge variant={TALKIE_BADGE[talkie.status]} label={talkie.status} />
          </CardContent>
        </Card>
      </Pressable>
    </Link>
  );
}

type QuickLink = { label: string; description: string; href: string; icon: LucideIcon };

const QUICK_LINKS: QuickLink[] = [
  { label: 'Scouting', description: 'Pit and match data collection', href: '/scouting', icon: ClipboardList },
  { label: 'Picklist', description: 'Tier teams for alliance selection', href: '/picklist', icon: ListOrdered },
  { label: 'Talkie', description: 'Live pit-crew intel requests', href: '/talkie', icon: Radio },
  { label: 'Pit schedule', description: 'Who’s staffing the pit', href: '/schedule', icon: CalendarClock },
];

function QuickLinkCard({ link }: { link: QuickLink }) {
  const router = useRouter();
  return (
    <Pressable
      className="flex-1 basis-full active:opacity-75 md:basis-[48%]"
      onPress={() => router.push(link.href as any)}
    >
      <Card className="hover:bg-accent/70">
        <CardContent className="flex-row items-center gap-4 p-4">
          <View className="h-11 w-11 items-center justify-center rounded-md bg-accent">
            <Icon as={link.icon} size={22} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">{link.label}</Text>
            <Text variant="muted">{link.description}</Text>
          </View>
          <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
        </CardContent>
      </Card>
    </Pressable>
  );
}

export default function CompetitionScreen() {
  const { session } = useAuth();
  const uid = session?.user?.id;
  const matches = useMatches();
  const shifts = usePitShifts();
  const talkies = useTalkieRequests();
  const teams = useTeamScores();
  useTalkieRealtime();

  const now = useNow();
  const myShifts = (shifts.data ?? [])
    .filter((s) => s.assignee_id === uid && new Date(s.end_time).getTime() > now)
    .slice(0, 3);

  const latestTalkies = [...(talkies.data ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);
  const openTalkies = (talkies.data ?? []).filter((t) => t.status !== 'resolved').length;

  return (
    <Screen>
      <ScreenHeader title="Competition" description="Live event operations at a glance." />

      <View className="flex-row flex-wrap gap-3">
        <Card className="min-w-[150px] flex-1">
          <CardContent className="gap-2 p-4">
            <Icon as={Users} size={22} className="text-primary" />
            <Text className="text-2xl font-extrabold">{teams.isLoading ? '—' : teams.data?.length ?? 0}</Text>
            <Text variant="muted">Teams scouted</Text>
          </CardContent>
        </Card>
        <Card className="min-w-[150px] flex-1">
          <CardContent className="gap-2 p-4">
            <Icon as={Radio} size={22} className="text-warning" />
            <Text className="text-2xl font-extrabold">{talkies.isLoading ? '—' : openTalkies}</Text>
            <Text variant="muted">Open talkies</Text>
          </CardContent>
        </Card>
      </View>

      <NextMatchCard matches={matches.data ?? []} />

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="title">My pit shifts</Text>
          <Link href={'/schedule' as any} asChild>
            <Pressable className="flex-row items-center gap-1 active:opacity-70">
              <Text variant="muted">Full schedule</Text>
              <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
            </Pressable>
          </Link>
        </View>
        {shifts.isLoading ? null : myShifts.length === 0 ? (
          <Card>
            <CardContent className="items-center gap-1 p-6">
              <Icon as={CalendarClock} size={22} className="text-muted-foreground" />
              <Text variant="muted">No upcoming pit shifts assigned to you.</Text>
            </CardContent>
          </Card>
        ) : (
          myShifts.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex-row items-center gap-3 p-4">
                <View className="items-center rounded-md border border-border bg-background px-3 py-1.5">
                  <Text className="text-sm font-bold tabular-nums text-primary">{formatTime(s.start_time)}</Text>
                </View>
                <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
                <View className="items-center rounded-md border border-border bg-background px-3 py-1.5">
                  <Text className="text-sm font-bold tabular-nums">{formatTime(s.end_time)}</Text>
                </View>
                <Text variant="muted" className="flex-1 text-right">
                  {formatDayLabel(s.start_time)}
                </Text>
              </CardContent>
            </Card>
          ))
        )}
      </View>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text variant="title">Latest talkies</Text>
          <Link href={'/talkie' as any} asChild>
            <Pressable className="flex-row items-center gap-1 active:opacity-70">
              <Text variant="muted">All talkies</Text>
              <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
            </Pressable>
          </Link>
        </View>
        {talkies.isLoading ? null : latestTalkies.length === 0 ? (
          <Card>
            <CardContent className="items-center gap-1 p-6">
              <Icon as={Trophy} size={22} className="text-muted-foreground" />
              <Text variant="muted">No talkie requests yet.</Text>
            </CardContent>
          </Card>
        ) : (
          latestTalkies.map((t) => <TalkieRow key={t.id} talkie={t} />)
        )}
      </View>

      <View className="gap-3">
        <Text variant="title">Go to</Text>
        <View className="flex-row flex-wrap gap-3">
          {QUICK_LINKS.map((l) => (
            <QuickLinkCard key={l.label} link={l} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
