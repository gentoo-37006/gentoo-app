import { ActivityIndicator, Pressable, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { CalendarRange, Upload, Wand2, ChevronRight } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import {
  useMatches,
  useMyAssignments,
  useAutoAssign,
  type MatchWithAssignments,
  type MyAssignment,
} from '@/lib/queries/matches';
import { matchTitle } from '@/lib/types';

function AllianceLine({ match }: { match: MatchWithAssignments }) {
  const fmt = (a: number | null, b: number | null) =>
    [a, b].filter((n) => n != null).join(' & ') || '—';
  return (
    <View className="flex-row gap-4">
      <Text className="text-sm font-semibold text-destructive">{fmt(match.red1, match.red2)}</Text>
      <Text variant="small">vs</Text>
      <Text className="text-sm font-semibold text-primary">{fmt(match.blue1, match.blue2)}</Text>
    </View>
  );
}

function MatchCard({ match }: { match: MatchWithAssignments }) {
  const submitted = match.assignments.filter((a) => a.status === 'submitted').length;
  const total = match.assignments.length;
  return (
    <Link href={`/scouting/matches/${match.id}` as any} asChild>
      <Pressable>
        <Card className="active:opacity-90">
          <CardContent className="flex-row items-center gap-3 p-4">
            <View className="flex-1 gap-1">
              <Text className="font-bold">{matchTitle(match)}</Text>
              <AllianceLine match={match} />
            </View>
            {total > 0 ? (
              <Badge
                variant={submitted === total ? 'success' : 'muted'}
                label={`${submitted}/${total}`}
              />
            ) : null}
            <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
          </CardContent>
        </Card>
      </Pressable>
    </Link>
  );
}

function MyAssignmentCard({ assignment }: { assignment: MyAssignment }) {
  const m = assignment.match;
  if (!m) return null;
  return (
    <Link href={`/scouting/matches/${m.id}` as any} asChild>
      <Pressable>
        <Card className="border-primary/40 bg-primary/5 active:opacity-90">
          <CardContent className="flex-row items-center gap-3 p-4">
            <View className="flex-1">
              <Text className="font-semibold">{matchTitle(m)}</Text>
              <Text variant="muted">
                {assignment.team_number ? `Watch team ${assignment.team_number}` : 'Scout this match'}
              </Text>
            </View>
            <Badge
              variant={assignment.status === 'submitted' ? 'success' : 'warning'}
              label={assignment.status === 'submitted' ? 'Submitted' : 'To do'}
            />
          </CardContent>
        </Card>
      </Pressable>
    </Link>
  );
}

export default function MatchesScreen() {
  const router = useRouter();
  const { isAdmin, session } = useAuth();
  const uid = session?.user?.id;
  const { data: matches, isLoading } = useMatches();
  const { data: myAssignments } = useMyAssignments(uid);
  const autoAssign = useAutoAssign();

  const todo = (myAssignments ?? []).filter((a) => a.status === 'assigned');

  return (
    <Screen>
      <ScreenHeader title="Match scouting" description="Assignments and the match schedule." backHref="/scouting">
        {isAdmin ? (
          <>
            <Button
              variant="outline"
              size="icon"
              icon={Wand2}
              accessibilityLabel="Auto-assign scouters"
              loading={autoAssign.isPending}
              onPress={() => autoAssign.mutate()}
            />
            <Button label="Import" icon={Upload} onPress={() => router.push('/scouting/matches/import' as any)} />
          </>
        ) : null}
      </ScreenHeader>

      {todo.length > 0 ? (
        <View className="gap-3">
          <Text variant="title">Your assignments</Text>
          {todo.map((a) => (
            <MyAssignmentCard key={a.id} assignment={a} />
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : (matches ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No matches yet"
          description={
            isAdmin
              ? 'Import the match schedule to start assigning scouters.'
              : 'The match schedule hasn’t been added yet.'
          }
        >
          {isAdmin ? (
            <Button label="Import schedule" icon={Upload} onPress={() => router.push('/scouting/matches/import' as any)} />
          ) : null}
        </EmptyState>
      ) : (
        <View className="gap-3">
          <Text variant="title">Schedule</Text>
          {(matches ?? []).map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </View>
      )}
    </Screen>
  );
}
