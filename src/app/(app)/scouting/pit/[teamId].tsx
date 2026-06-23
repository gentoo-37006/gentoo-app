import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardList, Plus, UserX } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { ScoreBar } from '@/components/ui/score-bar';
import { useCapabilityQuestions, useTeamDetail } from '@/lib/queries/scouting';
import { summarizeAnswers, weightedScore, scoreTint, type QuestionBreakdown } from '@/lib/scoring';
import { timeAgo } from '@/lib/format';

function BreakdownRow({ b }: { b: QuestionBreakdown }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-sm">{b.question.prompt}</Text>
        <Text className={`text-sm font-bold ${b.percent === null ? 'text-muted-foreground' : scoreTint(b.percent)}`}>
          {b.percent === null ? 'N/A' : `${b.percent}%`}
        </Text>
      </View>
      <ScoreBar
        value={b.percent ?? 0}
        fillClassName={
          b.percent === null
            ? 'bg-muted'
            : b.percent >= 70
            ? 'bg-success'
            : b.percent >= 40
            ? 'bg-warning'
            : 'bg-destructive'
        }
      />
      <Text variant="small">
        {b.yes} yes · {b.no} no{b.didNotSee ? ` · ${b.didNotSee} didn’t see` : ''}
      </Text>
    </View>
  );
}

export default function TeamDetailScreen() {
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { data, isLoading } = useTeamDetail(teamId);
  const { data: questions } = useCapabilityQuestions(false);

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Team" backHref="/scouting/pit" />
        <View className="py-12">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  const team = data?.team;
  if (!team) {
    return (
      <Screen>
        <ScreenHeader title="Team" backHref="/scouting/pit" />
        <EmptyState icon={UserX} title="Team not found" description="This team may have been removed." />
      </Screen>
    );
  }

  const entries = data?.entries ?? [];
  const allAnswers = entries.flatMap((e) => e.answers);
  const breakdowns = summarizeAnswers(questions ?? [], allAnswers).filter(
    (b) => b.yes + b.no + b.didNotSee > 0
  );
  const score = weightedScore(breakdowns);

  // Group breakdowns by category preserving order.
  const groups: { category: string; rows: QuestionBreakdown[] }[] = [];
  for (const b of breakdowns) {
    let g = groups.find((x) => x.category === b.question.category);
    if (!g) {
      g = { category: b.question.category, rows: [] };
      groups.push(g);
    }
    g.rows.push(b);
  }

  const goScout = () =>
    router.push(`/scouting/pit/scout?teamNumber=${team.team_number}&teamName=${encodeURIComponent(team.team_name ?? '')}` as any);

  return (
    <Screen>
      <ScreenHeader title={`Team ${team.team_number}`} description={team.team_name ?? undefined} backHref="/scouting/pit">
        <Button label="Report" icon={Plus} size="sm" onPress={goScout} />
      </ScreenHeader>

      <Card>
        <CardContent className="flex-row items-center justify-between p-5">
          <View>
            <Text variant="muted">Pick-list score</Text>
            <Text className={`text-4xl font-extrabold ${scoreTint(score)}`}>{score}%</Text>
          </View>
          <View className="items-end gap-1">
            <Badge variant="muted" label={`${entries.length} ${entries.length === 1 ? 'report' : 'reports'}`} />
            <Text variant="small">{breakdowns.length} capabilities measured</Text>
          </View>
        </CardContent>
      </Card>

      {breakdowns.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No capability data yet"
          description="Submit a pit scouting report to start measuring this team."
        >
          <Button label="Scout this team" icon={Plus} onPress={goScout} />
        </EmptyState>
      ) : (
        groups.map((g) => (
          <Card key={g.category}>
            <CardContent className="gap-4 p-5">
              <Text variant="title">{g.category}</Text>
              {g.rows.map((b) => (
                <BreakdownRow key={b.question.id} b={b} />
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {entries.length > 0 ? (
        <View className="gap-3">
          <Text variant="title">Reports</Text>
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="gap-2 p-4">
                <View className="flex-row items-center gap-2">
                  <Avatar name={e.scouter?.full_name} uri={e.scouter?.avatar_url} size={28} />
                  <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
                    {e.scouter?.full_name ?? 'Unknown scouter'}
                  </Text>
                  <Text variant="small">{timeAgo(e.created_at)}</Text>
                </View>
                {e.notes ? <Text variant="muted">{e.notes}</Text> : null}
                <Text variant="small">{e.answers.length} answers</Text>
              </CardContent>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
