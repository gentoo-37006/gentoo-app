import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CalendarX, Send, Shield, Star, UserPlus, X } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useProfiles } from '@/lib/queries/profiles';
import {
  useMatchDetail,
  useAssignScouter,
  useRemoveAssignment,
  useSubmitMatchReport,
} from '@/lib/queries/matches';
import { matchTitle, matchTeamNumbers, type Match } from '@/lib/types';

function TeamChip({ n, color }: { n: number | null; color: string }) {
  return (
    <View className="rounded-lg border border-border bg-background px-3 py-1.5">
      <Text className={cn('text-sm font-bold', color)}>{n ?? '—'}</Text>
    </View>
  );
}

function Alliances({ match }: { match: Match }) {
  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <View className="gap-1.5">
          <Text variant="small" className="font-semibold text-destructive">RED</Text>
          <View className="flex-row gap-2">
            <TeamChip n={match.red1} color="text-destructive" />
            <TeamChip n={match.red2} color="text-destructive" />
          </View>
        </View>
        <View className="gap-1.5">
          <Text variant="small" className="font-semibold text-primary">BLUE</Text>
          <View className="flex-row gap-2">
            <TeamChip n={match.blue1} color="text-primary" />
            <TeamChip n={match.blue2} color="text-primary" />
          </View>
        </View>
      </CardContent>
    </Card>
  );
}

function RatingPicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <View className="flex-row gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value != null && n <= value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            className="h-10 w-10 items-center justify-center rounded-lg border border-border active:bg-accent"
          >
            <Icon as={Star} size={20} className={active ? 'text-warning' : 'text-muted-foreground'} />
          </Pressable>
        );
      })}
    </View>
  );
}

function ReportForm({
  match,
  assignmentId,
  defaultTeam,
}: {
  match: Match;
  assignmentId?: string;
  defaultTeam: number | null;
}) {
  const submit = useSubmitMatchReport();
  const teams = matchTeamNumbers(match);
  const [team, setTeam] = React.useState<number | null>(defaultTeam ?? teams[0] ?? null);
  const [manualTeam, setManualTeam] = React.useState('');
  const [rating, setRating] = React.useState<number | null>(null);
  const [defense, setDefense] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [done, setDone] = React.useState(false);

  const teamNumber = teams.length > 0 ? team : parseInt(manualTeam, 10);
  const canSubmit = Number.isFinite(teamNumber as number) && (teamNumber as number) > 0 && !submit.isPending;

  const onSubmit = async () => {
    await submit.mutateAsync({
      assignmentId,
      matchId: match.id,
      matchLabel: matchTitle(match),
      teamNumber: teamNumber as number,
      rating: rating ?? undefined,
      playedDefense: defense,
      notes: notes.trim() || undefined,
    });
    setRating(null);
    setDefense(false);
    setNotes('');
    setDone(true);
  };

  return (
    <Card>
      <CardContent className="gap-4 p-4">
        <Text variant="title">Submit a report</Text>

        <View className="gap-1.5">
          <Text variant="label">Team</Text>
          {teams.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {teams.map((n) => {
                const active = team === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setTeam(n)}
                    className={cn(
                      'rounded-lg border px-3 py-2',
                      active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
                    )}
                  >
                    <Text className={cn('text-sm font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Input
              value={manualTeam}
              onChangeText={setManualTeam}
              keyboardType="number-pad"
              placeholder="Team number"
            />
          )}
        </View>

        <View className="gap-1.5">
          <Text variant="label">Performance</Text>
          <RatingPicker value={rating} onChange={setRating} />
        </View>

        <Pressable
          onPress={() => setDefense((d) => !d)}
          className="flex-row items-center gap-2 self-start"
        >
          <View
            className={cn(
              'h-5 w-5 items-center justify-center rounded border',
              defense ? 'border-primary bg-primary' : 'border-border'
            )}
          >
            {defense ? <Icon as={Shield} size={12} className="text-primary-foreground" /> : null}
          </View>
          <Text className="text-sm">Played defense</Text>
        </Pressable>

        <Textarea value={notes} onChangeText={setNotes} placeholder="What happened in the match?" />

        {done ? <Text className="text-success">Report submitted — strategists notified.</Text> : null}

        <Button
          label="Submit report"
          icon={Send}
          loading={submit.isPending}
          disabled={!canSubmit}
          onPress={onSubmit}
        />
      </CardContent>
    </Card>
  );
}

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { session, isAdmin } = useAuth();
  const uid = session?.user?.id;
  const { data, isLoading } = useMatchDetail(matchId);
  const { data: profiles } = useProfiles();
  const assign = useAssignScouter();
  const removeAssignment = useRemoveAssignment();

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Match" backHref="/scouting/matches" />
        <View className="py-12">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  const match = data?.match;
  if (!match) {
    return (
      <Screen>
        <ScreenHeader title="Match" backHref="/scouting/matches" />
        <EmptyState icon={CalendarX} title="Match not found" description="This match may have been removed." />
      </Screen>
    );
  }

  const assignments = data?.assignments ?? [];
  const reports = data?.reports ?? [];
  const myAssignment = assignments.find((a) => a.scouter_id === uid);
  const assignedIds = new Set(assignments.map((a) => a.scouter_id));
  const approved = (profiles ?? []).filter((p) => p.status === 'approved' && !assignedIds.has(p.id));

  return (
    <Screen>
      <ScreenHeader title={matchTitle(match)} backHref="/scouting/matches" />

      <Alliances match={match} />

      <ReportForm match={match} assignmentId={myAssignment?.id} defaultTeam={myAssignment?.team_number ?? null} />

      <Card>
        <CardContent className="gap-3 p-4">
          <Text variant="title">Assignments</Text>
          {assignments.length === 0 ? (
            <Text variant="muted">No one is assigned to this match yet.</Text>
          ) : (
            assignments.map((a) => {
              const canRemove = isAdmin || a.assigned_by === uid;
              return (
                <View key={a.id} className="flex-row items-center gap-2">
                  <Avatar name={a.scouter?.full_name} uri={a.scouter?.avatar_url} size={28} />
                  <Text className="flex-1 text-sm" numberOfLines={1}>
                    {a.scouter?.full_name ?? 'Member'}
                    {a.team_number ? ` · team ${a.team_number}` : ''}
                  </Text>
                  <Badge
                    variant={a.status === 'submitted' ? 'success' : 'warning'}
                    label={a.status === 'submitted' ? 'Submitted' : 'Assigned'}
                  />
                  {canRemove ? (
                    <Pressable
                      onPress={() => removeAssignment.mutate(a.id)}
                      className="h-7 w-7 items-center justify-center rounded-full active:bg-accent"
                    >
                      <Icon as={X} size={16} className="text-muted-foreground" />
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}

          {approved.length > 0 ? (
            <View className="gap-2 border-t border-border pt-3">
              <View className="flex-row items-center gap-1.5">
                <Icon as={UserPlus} size={16} className="text-muted-foreground" />
                <Text variant="small">Assign a scouter</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {approved.map((p) => (
                  <Pressable
                    key={p.id}
                    disabled={assign.isPending}
                    onPress={() =>
                      assign.mutate({ matchId: match.id, scouterId: p.id, matchLabel: matchTitle(match) })
                    }
                    className="rounded-full border border-border bg-background px-3 py-1.5 active:bg-accent"
                  >
                    <Text className="text-xs font-semibold">{p.full_name ?? 'Member'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </CardContent>
      </Card>

      {reports.length > 0 ? (
        <Card>
          <CardContent className="gap-3 p-4">
            <Text variant="title">Reports ({reports.length})</Text>
            {reports.map((r) => (
              <View key={r.id} className="gap-1 border-b border-border pb-2 last:border-0">
                <View className="flex-row items-center gap-2">
                  <Text className="font-semibold">Team {r.team_number}</Text>
                  {r.rating ? <Badge variant="warning" label={`${r.rating}★`} /> : null}
                  {r.played_defense ? <Badge variant="muted" label="Defense" /> : null}
                </View>
                {r.notes ? <Text variant="muted">{r.notes}</Text> : null}
              </View>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </Screen>
  );
}
