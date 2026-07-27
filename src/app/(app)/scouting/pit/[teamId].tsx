import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, ClipboardList, Plus, UserX } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import {
  useCapabilityQuestions,
  useTeamDetail,
  type EntryWithDetails,
} from '@/lib/queries/scouting';
import { summarizeAnswers, summarizeEntry, type QuestionBreakdown } from '@/lib/scoring';
import { teamRecord, timeAgo } from '@/lib/format';
import type { AnswerValue, CapabilityQuestion } from '@/lib/types';

/** Verdict chip: what most scouters answered for this capability. */
function verdictOf(b: QuestionBreakdown): { label: string; variant: 'success' | 'destructive' | 'warning' | 'muted' } {
  if (b.yesFraction === null) return { label: 'Not seen', variant: 'muted' };
  if (b.yes === b.no) return { label: 'Split', variant: 'warning' };
  return b.yes > b.no ? { label: 'Yes', variant: 'success' } : { label: 'No', variant: 'destructive' };
}

const ANSWER_BADGE: Record<AnswerValue, { label: string; variant: 'success' | 'destructive' | 'muted' }> = {
  yes: { label: 'Yes', variant: 'success' },
  no: { label: 'No', variant: 'destructive' },
  did_not_see: { label: 'Didn’t see', variant: 'muted' },
};

/** One scouter's report; tap to see exactly what they answered. */
function ReportCard({
  entry,
  questions,
}: {
  entry: EntryWithDetails;
  questions: CapabilityQuestion[];
}) {
  const [open, setOpen] = React.useState(false);
  const summary = summarizeEntry(questions, entry.answers);

  return (
    <Card>
      <CardContent className="gap-2 p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${open ? 'Hide' : 'Show'} answers from ${entry.scouter?.full_name ?? 'unknown scouter'}`}
          onPress={() => setOpen((prev) => !prev)}
          className="gap-2 active:opacity-70"
        >
          <View className="flex-row items-center gap-2">
            <Avatar name={entry.scouter?.full_name} uri={entry.scouter?.avatar_url} size={28} />
            <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
              {entry.scouter?.full_name ?? 'Unknown scouter'}
            </Text>
            <Text variant="small">{timeAgo(entry.created_at)}</Text>
            <Icon as={open ? ChevronDown : ChevronRight} size={16} className="text-muted-foreground" />
          </View>
          {entry.notes ? <Text variant="muted">{entry.notes}</Text> : null}
          <Text variant="small">
            {summary.rows.length === 0
              ? 'No capability answers'
              : `${summary.yes} yes · ${summary.no} no${
                  summary.didNotSee ? ` · ${summary.didNotSee} didn’t see` : ''
                }`}
          </Text>
        </Pressable>

        {open && summary.rows.length > 0 ? (
          <View className="gap-2 border-t border-border pt-3">
            {summary.rows.map((row, index) => {
              const previous = summary.rows[index - 1];
              const startsCategory = !previous || previous.question.category !== row.question.category;
              const badge = ANSWER_BADGE[row.answer];
              return (
                <View key={row.question.id} className="gap-2">
                  {startsCategory ? (
                    <Text variant="label" className="text-muted-foreground">
                      {row.question.category}
                    </Text>
                  ) : null}
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm">{row.question.prompt}</Text>
                    <Badge variant={badge.variant} label={badge.label} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ b }: { b: QuestionBreakdown }) {
  const verdict = verdictOf(b);
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1 gap-0.5">
        <Text className="text-sm">{b.question.prompt}</Text>
        <Text variant="small">
          {b.yes} yes · {b.no} no{b.didNotSee ? ` · ${b.didNotSee} didn’t see` : ''}
        </Text>
      </View>
      <Badge variant={verdict.variant} label={verdict.label} />
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

  const record = teamRecord(team.official_wins, team.official_losses, team.official_ties);
  const hasOfficialStats =
    team.official_rank != null || record !== null || team.official_avg_points != null;

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
            <Text variant="muted">Scouting reports</Text>
            <Text className="text-4xl font-extrabold">{entries.length}</Text>
          </View>
          <Text variant="small">{breakdowns.length} capabilities measured</Text>
        </CardContent>
      </Card>

      {hasOfficialStats ? (
        <Card>
          <CardContent className="gap-3 p-5">
            <View className="flex-row items-center justify-between gap-3">
              <Text variant="title">Official standings</Text>
              {team.stats_synced_at ? (
                <Text variant="small">synced {timeAgo(team.stats_synced_at)}</Text>
              ) : null}
            </View>
            <View className="flex-row flex-wrap items-center gap-2">
              {team.official_rank != null ? (
                <Badge variant="secondary" label={`Rank ${team.official_rank}`} />
              ) : null}
              {record ? <Badge variant="muted" label={`${record} W–L–T`} /> : null}
              {team.official_avg_points != null ? (
                <Badge
                  variant="muted"
                  label={`${Number(team.official_avg_points).toFixed(1)} avg pts`}
                />
              ) : null}
            </View>
            <Text variant="small">From FTC Scout — how this team is actually doing at the event.</Text>
          </CardContent>
        </Card>
      ) : null}

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
            <ReportCard key={e.id} entry={e} questions={questions ?? []} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
