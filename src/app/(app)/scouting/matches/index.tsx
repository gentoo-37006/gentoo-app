import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarRange, Upload, Wand2, ChevronRight } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useMatches, useAutoAssign, type MatchWithAssignments } from '@/lib/queries/matches';
import { matchTitle, type Match } from '@/lib/types';

function AllianceLine({ match }: { match: MatchWithAssignments | Match }) {
  const fmt = (a: number | null, b: number | null) =>
    [a, b].filter((n) => n != null).join(' & ') || '—';
    
  const played = match.has_been_played;
  const redWon = played && (match.red_score ?? 0) > (match.blue_score ?? 0);
  const blueWon = played && (match.blue_score ?? 0) > (match.red_score ?? 0);
  const tie = played && (match.blue_score ?? 0) === (match.red_score ?? 0);

  return (
    <View className="flex-col gap-1">
      <View className="flex-row gap-4 items-center">
        <Text className={cn("text-sm font-semibold text-destructive", redWon && "font-black underline")}>
          {fmt(match.red1, match.red2)}
        </Text>
        <Text variant="small">vs</Text>
        <Text className={cn("text-sm font-semibold text-alliance-blue", blueWon && "font-black underline")}>
          {fmt(match.blue1, match.blue2)}
        </Text>
      </View>
      {played && (
        <View className="flex-row gap-2 items-center">
          <Badge variant={redWon ? "destructive" : "secondary"} label={String(match.red_score ?? 0)} />
          <Text variant="small">-</Text>
          <Badge variant={blueWon ? "allianceBlue" : "secondary"} label={String(match.blue_score ?? 0)} />
          {tie && <Text variant="small" className="text-muted-foreground ml-2">(Tie)</Text>}
        </View>
      )}
    </View>
  );
}

function MatchCard({ match, uid }: { match: MatchWithAssignments; uid?: string }) {
  const router = useRouter();
  const submitted = match.assignments.filter((a) => a.status === 'submitted').length;
  const total = match.assignments.length;
  const mine = match.assignments.find((a) => a.scouter_id === uid);
  return (
    <Pressable
      className={cn(
        'rounded-md border border-border bg-card active:opacity-75',
            mine
              ? 'border-primary/40 bg-primary/5 hover:bg-accent/70'
              : 'hover:bg-accent/70'
      )}
      onPress={() => router.push(`/scouting/matches/${match.id}` as any)}
    >
          <View className="flex-row items-center gap-3 p-4">
            <View className="flex-1 gap-1">
              <Text className="font-bold">{matchTitle(match)}</Text>
              <AllianceLine match={match} />
              {mine ? (
                <Text variant="small" className="text-primary">
                  {mine.team_number ? `You: watch team ${mine.team_number}` : 'Assigned to you'}
                </Text>
              ) : null}
            </View>
            {mine ? (
              <Badge
                variant={mine.status === 'submitted' ? 'success' : 'warning'}
                label={mine.status === 'submitted' ? 'Submitted' : 'To do'}
              />
            ) : total > 0 ? (
              <Badge
                variant={submitted === total ? 'success' : 'muted'}
                label={`${submitted}/${total}`}
              />
            ) : null}
            <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
          </View>
    </Pressable>
  );
}

export default function MatchesScreen() {
  const router = useRouter();
  const { isAdmin, session } = useAuth();
  const uid = session?.user?.id;
  const { data: matches, isLoading } = useMatches();
  const autoAssign = useAutoAssign();

  return (
    <Screen>
      <ScreenHeader title="Match scouting" description="Matches assigned to you are highlighted." backHref="/scouting">
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
          {(matches ?? []).map((m) => (
            <MatchCard key={m.id} match={m} uid={uid} />
          ))}
        </View>
      )}
    </Screen>
  );
}
