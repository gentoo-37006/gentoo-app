import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import {
  Trophy,
  ClipboardList,
  ListOrdered,
  Radio,
  CalendarClock,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import { useNow } from '@/lib/use-now';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { ActiveEventCard } from '@/components/active-event-card';
import { NextMatchCard } from '@/components/competition/next-match-card';
import { OurMatchesCard } from '@/components/competition/our-matches-card';
import { AgendaEditor, EventScheduleCard, JudgingCard } from '@/components/competition/event-schedule';
import { ResetScoutingCard } from '@/components/competition/reset-scouting';
import type { AgendaKind } from '@/lib/competition';
import { useAuth } from '@/lib/auth';
import { useMatches } from '@/lib/queries/matches';
import { usePitShifts } from '@/lib/queries/schedule';
import { useTalkieRequests, type TalkieWithPeople } from '@/lib/queries/talkie';
import { useEventAgenda } from '@/lib/queries/event-agenda';
import { useActiveEvent } from '@/lib/use-active-event';
import type { TalkieStatus } from '@/lib/types';
import { formatTime, formatDayLabel, timeAgo } from '@/lib/format';

const TALKIE_BADGE: Record<TalkieStatus, 'warning' | 'secondary' | 'success'> = {
  open: 'warning',
  claimed: 'secondary',
  resolved: 'success',
};

function TalkieRow({ talkie }: { talkie: TalkieWithPeople }) {
  return (
    <Link href={'/talkie' as any} asChild>
      <Pressable className="rounded-md border border-border bg-card active:opacity-75 hover:bg-accent/70">
          <View className="flex-row items-center gap-3 p-4">
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold">Team {talkie.team_number}</Text>
              <Text variant="small" numberOfLines={1}>
                {talkie.reason}
              </Text>
            </View>
            <Text variant="small">{timeAgo(talkie.created_at)}</Text>
            <Badge variant={TALKIE_BADGE[talkie.status]} label={talkie.status} />
          </View>
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
      className="flex-1 basis-full rounded-md border border-border bg-card active:opacity-75 hover:bg-accent/70 md:basis-[48%]"
      onPress={() => router.push(link.href as any)}
    >
        <View className="flex-row items-center gap-4 p-4">
          <View className="h-11 w-11 items-center justify-center rounded-md bg-accent">
            <Icon as={link.icon} size={22} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">{link.label}</Text>
            <Text variant="muted">{link.description}</Text>
          </View>
          <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
        </View>
    </Pressable>
  );
}

function SectionHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="title">{title}</Text>
      <Link href={href as any} asChild>
        <Pressable className="flex-row items-center gap-1 active:opacity-70">
          <Text variant="muted">{linkLabel}</Text>
          <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
        </Pressable>
      </Link>
    </View>
  );
}

export default function CompetitionScreen() {
  const { session, isAdmin } = useAuth();
  const uid = session?.user?.id;
  const matches = useMatches();
  const shifts = usePitShifts();
  const talkies = useTalkieRequests();
  const { code, event } = useActiveEvent();
  const agenda = useEventAgenda(code);
  const [editor, setEditor] = React.useState<{ open: boolean; startWith: AgendaKind | null }>({
    open: false,
    startWith: null,
  });

  const now = useNow();
  const myShifts = (shifts.data ?? [])
    .filter((s) => s.assignee_id === uid && new Date(s.end_time).getTime() > now)
    .slice(0, 3);

  // Open requests first: those still need someone to act on them.
  const latestTalkies = [...(talkies.data ?? [])]
    .sort(
      (a, b) =>
        Number(a.status === 'resolved') - Number(b.status === 'resolved') ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 3);

  const today = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayValue = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const eventStart = event.data?.start?.slice(0, 10);
  const defaultDate = eventStart && eventStart > todayValue ? eventStart : todayValue;

  return (
    <Screen>
      <ScreenHeader title="Competition" description="Event day at a glance: our matches, schedule and judging." />

      <ActiveEventCard />

      <View className="gap-4 lg:flex-row lg:items-start">
        <View className="gap-4 lg:min-w-0 lg:flex-1">
          <NextMatchCard matches={matches.data ?? []} />
          <JudgingCard
            eventCode={code}
            agenda={agenda.items}
            canEdit={isAdmin}
            onAdd={() => setEditor({ open: true, startWith: 'judging' })}
          />
          <OurMatchesCard matches={matches.data ?? []} />
        </View>

        <View className="gap-4 lg:min-w-0 lg:flex-1">
          <EventScheduleCard
            eventCode={code}
            agenda={agenda.items}
            matches={matches.data ?? []}
            canEdit={isAdmin}
            onEdit={() => setEditor({ open: true, startWith: null })}
          />

          <View className="gap-3">
            <SectionHeader title="My pit shifts" href="/schedule" linkLabel="Full schedule" />
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
            <SectionHeader title="Talkies" href="/talkie" linkLabel="All talkies" />
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
        </View>
      </View>

      <View className="gap-3">
        <Text variant="title">Go to</Text>
        <View className="flex-row flex-wrap gap-3">
          {QUICK_LINKS.map((l) => (
            <QuickLinkCard key={l.label} link={l} />
          ))}
        </View>
      </View>

      {isAdmin ? <ResetScoutingCard /> : null}

      {isAdmin ? (
        <AgendaEditor
          visible={editor.open}
          onClose={() => setEditor({ open: false, startWith: null })}
          eventCode={code}
          agenda={agenda.items}
          defaultDate={defaultDate}
          startWith={editor.startWith}
        />
      ) : null}
    </Screen>
  );
}
