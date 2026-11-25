import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Swords } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { matchResult, matchSides, ourMatches } from '@/lib/competition';
import { formatTime } from '@/lib/format';
import type { MatchWithAssignments } from '@/lib/queries/matches';
import { OUR_TEAM_NUMBER } from '@/lib/team';
import { matchTitle } from '@/lib/types';
import { cn } from '@/lib/utils';

const OUTCOME = {
  win: { letter: 'W', className: 'bg-success text-success-foreground' },
  loss: { letter: 'L', className: 'bg-destructive text-destructive-foreground' },
  tie: { letter: 'T', className: 'bg-muted text-foreground' },
} as const;

/** Every match we're in: the alliance we're on, who's with and against us, and how it went. */
export function OurMatchesCard({ matches }: { matches: MatchWithAssignments[] }) {
  const router = useRouter();
  const ours = ourMatches(matches, OUR_TEAM_NUMBER);

  return (
    <Card>
      <CardContent className="gap-3 p-5">
        <View className="flex-row items-center gap-2">
          <Icon as={Swords} size={16} className="text-primary" />
          <Text variant="label" className="text-muted-foreground">
            Our matches
          </Text>
          {ours.length > 0 ? <Text variant="small">· {ours.length}</Text> : null}
        </View>
        {ours.length === 0 ? (
          <Text variant="muted">Our matches show here once the schedule is synced.</Text>
        ) : (
          <View className="gap-1">
            {ours.map((match) => {
              const sides = matchSides(match, OUR_TEAM_NUMBER)!;
              const result = matchResult(match, OUR_TEAM_NUMBER);
              return (
                <Pressable
                  key={match.id}
                  accessibilityRole="link"
                  accessibilityLabel={`${matchTitle(match)}, ${sides.alliance} alliance${result ? `, ${result.outcome} ${result.ours} to ${result.theirs}` : ''}`}
                  onPress={() => router.push(`/scouting/matches/${match.id}` as any)}
                  className="flex-row items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/70 active:bg-accent"
                >
                  <View className={cn('h-8 w-1.5 rounded-full', sides.alliance === 'red' ? 'bg-destructive' : 'bg-alliance-blue')} />
                  <View className="w-16">
                    <Text className="text-sm font-bold">{matchTitle(match)}</Text>
                    <Text variant="small" className="text-[11px]">
                      {match.scheduled_time ? formatTime(match.scheduled_time) : 'Time TBA'}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm">
                      <Text variant="small">with </Text>
                      {sides.partners.join(', ') || '—'}
                    </Text>
                    <Text numberOfLines={1} className="text-sm">
                      <Text variant="small">vs </Text>
                      {sides.opponents.join(', ') || '—'}
                    </Text>
                  </View>
                  {result ? (
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-semibold tabular-nums">
                        {result.ours}–{result.theirs}
                      </Text>
                      <View className={cn('h-6 w-6 items-center justify-center rounded-sm', OUTCOME[result.outcome].className)}>
                        <Text className={cn('text-xs font-bold', OUTCOME[result.outcome].className)}>{OUTCOME[result.outcome].letter}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text variant="small">Upcoming</Text>
                  )}
                  <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
                </Pressable>
              );
            })}
          </View>
        )}
      </CardContent>
    </Card>
  );
}
