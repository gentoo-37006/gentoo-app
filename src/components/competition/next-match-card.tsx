import { View } from 'react-native';
import { Timer } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { matchResult, matchSides, nextMatch, ourMatches } from '@/lib/competition';
import { formatDayLabel, formatTime } from '@/lib/format';
import type { MatchWithAssignments } from '@/lib/queries/matches';
import { OUR_TEAM_NUMBER } from '@/lib/team';
import { matchTitle } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';

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

export function TeamChips({ teams, alliance, us }: { teams: number[]; alliance: 'red' | 'blue'; us?: boolean }) {
  return (
    <>
      {teams.map((team) => (
        <Badge
          key={`${alliance}${team}`}
          variant={alliance === 'red' ? 'destructive' : 'allianceBlue'}
          label={us && team === OUR_TEAM_NUMBER ? `${team} (us)` : String(team)}
        />
      ))}
    </>
  );
}

/** Countdown to our next match, with who we play with and against. */
export function NextMatchCard({ matches }: { matches: MatchWithAssignments[] }) {
  // 1s ticks: this card renders a live countdown.
  const now = useNow(1000);
  const upcoming = nextMatch(matches, OUR_TEAM_NUMBER, now);
  const sides = upcoming ? matchSides(upcoming, OUR_TEAM_NUMBER) : null;
  const ours = ourMatches(matches, OUR_TEAM_NUMBER);
  const last = [...ours].reverse().find((match) => matchResult(match, OUR_TEAM_NUMBER));
  const lastResult = last ? matchResult(last, OUR_TEAM_NUMBER) : null;
  const startsIn = upcoming ? new Date(upcoming.scheduled_time!).getTime() - now : 0;

  return (
    <Card>
      <CardContent className="gap-4 p-5">
        <View className="flex-row items-center gap-2">
          <Icon as={Timer} size={16} className="text-primary" />
          <Text variant="label" className="text-muted-foreground">
            Our next match
          </Text>
        </View>

        {!upcoming || !sides ? (
          <Text variant="muted">
            {ours.length === 0
              ? `Team ${OUR_TEAM_NUMBER} has no matches in the synced schedule yet.`
              : 'No more matches scheduled for us.'}
          </Text>
        ) : (
          <>
            {startsIn > 0 ? (
              <View className="flex-row items-end gap-3">
                {countdownParts(startsIn).map((p) => (
                  <View key={p.label} className="items-center rounded-md border border-border bg-background px-3 py-2">
                    <Text className="text-3xl font-extrabold tabular-nums text-primary">{p.value}</Text>
                    <Text variant="small" className="uppercase tracking-wider">
                      {p.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-2xl font-extrabold text-primary">On the field now</Text>
            )}
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-bold">{matchTitle(upcoming)}</Text>
              <Text variant="muted">
                {formatDayLabel(upcoming.scheduled_time!)} · {formatTime(upcoming.scheduled_time!)}
              </Text>
            </View>
            <View
              className={cn(
                'gap-2 rounded-md border px-3 py-2.5',
                sides.alliance === 'red' ? 'border-destructive/40 bg-destructive/10' : 'border-alliance-blue/40 bg-alliance-blue/10'
              )}
            >
              <Text className="text-sm font-semibold">
                We’re on the {sides.alliance} alliance
              </Text>
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text variant="small" className="w-20">With</Text>
                {sides.partners.length > 0 ? (
                  <TeamChips teams={sides.partners} alliance={sides.alliance} />
                ) : (
                  <Text variant="small">No partner listed</Text>
                )}
              </View>
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text variant="small" className="w-20">Against</Text>
                <TeamChips teams={sides.opponents} alliance={sides.alliance === 'red' ? 'blue' : 'red'} />
              </View>
            </View>
          </>
        )}

        {last && lastResult ? (
          <Text variant="small">
            Last match: {matchTitle(last)},{' '}
            <Text
              variant="small"
              className={cn(
                'font-semibold',
                lastResult.outcome === 'win' ? 'text-success' : lastResult.outcome === 'loss' ? 'text-destructive' : 'text-foreground'
              )}
            >
              {lastResult.outcome === 'win' ? 'won' : lastResult.outcome === 'loss' ? 'lost' : 'tied'} {lastResult.ours}–{lastResult.theirs}
            </Text>
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
