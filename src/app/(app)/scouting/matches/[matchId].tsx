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
import { MultiSelect } from '@/components/ui/select';
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

function ScoreColumn({ label, auto, dc, penalty, total, isWinner }: {
  label: string;
  auto?: number | null;
  dc?: number | null;
  penalty?: number | null;
  total?: number | null;
  isWinner?: boolean;
}) {
  const isRed = label === 'RED';
  const teamColor = isRed ? 'text-destructive' : 'text-alliance-blue';
  const bgColor = isRed
    ? isWinner ? 'bg-destructive/15 border-destructive' : 'border-border'
    : isWinner ? 'bg-alliance-blue/15 border-alliance-blue' : 'border-border';
  return (
    <View className={cn('flex-1 rounded-lg border p-3 gap-1.5', bgColor)}>
      <View className="flex-row items-center justify-between">
        <Text className={cn('text-sm font-bold', teamColor)}>{label}</Text>
        {isWinner && <Badge variant={isRed ? 'destructive' : 'allianceBlue'} label="WIN" />}
      </View>
      {auto != null && (
        <View className="flex-row justify-between">
          <Text variant="small" className="text-muted-foreground">Auto</Text>
          <Text variant="small" className="font-semibold">{auto}</Text>
        </View>
      )}
      {dc != null && (
        <View className="flex-row justify-between">
          <Text variant="small" className="text-muted-foreground">Teleop</Text>
          <Text variant="small" className="font-semibold">{dc}</Text>
        </View>
      )}
      {penalty != null && (
        <View className="flex-row justify-between">
          <Text variant="small" className="text-muted-foreground">Penalty</Text>
          <Text variant="small" className="font-semibold">{penalty}</Text>
        </View>
      )}
      {total != null && (
        <View className="flex-row justify-between border-t border-border mt-1 pt-1">
          <Text variant="small" className="text-muted-foreground">Total</Text>
          <Text className={cn('text-base font-black', teamColor)}>{total}</Text>
        </View>
      )}
    </View>
  );
}

function Alliances({ match }: { match: Match }) {
  const played = !!match.has_been_played;
  const redTotal = match.red_score ?? null;
  const blueTotal = match.blue_score ?? null;
  const redWon = played && redTotal !== null && blueTotal !== null && redTotal > blueTotal;
  const blueWon = played && redTotal !== null && blueTotal !== null && blueTotal > redTotal;
  const tie = played && redTotal !== null && blueTotal !== null && redTotal === blueTotal;

  const levelLabel = match.tournament_level
    ? match.tournament_level.charAt(0).toUpperCase() + match.tournament_level.slice(1).toLowerCase()
    : null;

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        {/* Tournament level + scheduled time header */}
        <View className="flex-row items-center gap-2">
          {levelLabel && <Badge variant="secondary" label={levelLabel} />}
          {match.scheduled_time && (
            <Text variant="small" className="text-muted-foreground">
              {new Date(match.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          {tie && <Badge variant="muted" label="TIE" />}
        </View>

        {/* Alliance columns */}
        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <View className="flex-row gap-2">
              <TeamChip n={match.red1} color="text-destructive" />
              <TeamChip n={match.red2} color="text-destructive" />
            </View>
            <ScoreColumn
              label="RED"
              auto={played ? match.red_auto : undefined}
              dc={played ? match.red_dc : undefined}
              penalty={played ? match.red_penalty : undefined}
              total={played ? redTotal : undefined}
              isWinner={redWon}
            />
          </View>
          <View className="flex-1 gap-2">
            <View className="flex-row gap-2">
              <TeamChip n={match.blue1} color="text-alliance-blue" />
              <TeamChip n={match.blue2} color="text-alliance-blue" />
            </View>
            <ScoreColumn
              label="BLUE"
              auto={played ? match.blue_auto : undefined}
              dc={played ? match.blue_dc : undefined}
              penalty={played ? match.blue_penalty : undefined}
              total={played ? blueTotal : undefined}
              isWinner={blueWon}
            />
          </View>
        </View>

        {!played && (
          <Text variant="small" className="text-muted-foreground text-center">Match not yet played</Text>
        )}
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
  const assignedIds = assignments.map((a) => a.scouter_id);
  const scouterOptions = (profiles ?? [])
    .filter((p) => p.status === 'approved')
    .map((p) => ({ value: p.id, label: p.full_name ?? 'Member' }));

  // Toggling an option assigns or unassigns; removals the member isn't allowed to
  // make are skipped, matching the per-row remove button.
  const setAssignees = (next: string[]) => {
    next
      .filter((id) => !assignedIds.includes(id))
      .forEach((id) => assign.mutate({ matchId: match.id, scouterId: id, matchLabel: matchTitle(match) }));
    assignments
      .filter((a) => !next.includes(a.scouter_id) && (isAdmin || a.assigned_by === uid))
      .forEach((a) => removeAssignment.mutate(a.id));
  };

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
                      className="h-7 w-7 items-center justify-center rounded-sm active:bg-accent"
                    >
                      <Icon as={X} size={16} className="text-muted-foreground" />
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}

          {scouterOptions.length > 0 ? (
            <View className="gap-2 border-t border-border pt-3">
              <View className="flex-row items-center gap-1.5">
                <Icon as={UserPlus} size={16} className="text-muted-foreground" />
                <Text variant="small">Assign scouters</Text>
              </View>
              <MultiSelect
                options={scouterOptions}
                values={assignedIds}
                onChange={setAssignees}
                placeholder="No one assigned"
              />
              {assign.error ? (
                <Text variant="small" className="text-destructive">{assign.error.message}</Text>
              ) : null}
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
