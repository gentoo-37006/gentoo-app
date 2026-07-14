import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { ListOrdered, Search, SlidersHorizontal, NotebookPen } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScoreBar } from '@/components/ui/score-bar';
import { cn } from '@/lib/utils';
import { scoreTint } from '@/lib/scoring';
import { useCapabilityQuestions } from '@/lib/queries/scouting';
import { usePicklist, useSetTier, useSetPicklistNotes, type PicklistTeam } from '@/lib/queries/picklist';
import { PICKLIST_TIERS, type PicklistTier } from '@/lib/types';

const TIER_FILL: Record<PicklistTier, string> = {
  tier1: 'bg-success',
  tier2: 'bg-primary',
  tier3: 'bg-warning',
  dnp: 'bg-destructive',
};
const SCORE_PRESETS = [0, 40, 60, 80];
const TIER_GROUP_ORDER: (PicklistTier | 'untiered')[] = ['tier1', 'tier2', 'tier3', 'untiered', 'dnp'];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-sm border px-3 py-1.5',
        active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
      )}
    >
      <Text className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
        {label}
      </Text>
    </Pressable>
  );
}

function TierSelector({ team }: { team: PicklistTeam }) {
  const setTier = useSetTier();
  return (
    <View className="flex-row gap-1.5">
      {PICKLIST_TIERS.map((t) => {
        const active = team.tier === t.value;
        return (
          <Pressable
            key={t.value}
            disabled={setTier.isPending}
            onPress={() => setTier.mutate({ teamId: team.id, tier: active ? null : t.value })}
            className={cn(
              'flex-1 items-center rounded-lg border py-1.5',
              active ? `border-transparent ${TIER_FILL[t.value]}` : 'border-border bg-background active:bg-accent'
            )}
          >
            <Text className={cn('text-xs font-bold', active ? 'text-white' : 'text-muted-foreground')}>
              {t.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TeamRow({ team }: { team: PicklistTeam }) {
  const setNotes = useSetPicklistNotes();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(team.notes ?? '');

  const onSave = async () => {
    await setNotes.mutateAsync({ teamId: team.id, notes: draft.trim() });
    setEditing(false);
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <Link href={`/scouting/pit/${team.id}` as any} asChild>
          <Pressable className="flex-row items-center gap-3 active:opacity-80">
            <View className="flex-1">
              <Text className="font-bold">Team {team.team_number}</Text>
              <Text variant="muted" numberOfLines={1}>
                {team.team_name ?? 'Unknown name'}
              </Text>
            </View>
            <Text className={`text-xl font-extrabold ${scoreTint(team.score)}`}>{team.score}%</Text>
          </Pressable>
        </Link>
        <ScoreBar
          value={team.score}
          fillClassName={team.score >= 70 ? 'bg-success' : team.score >= 40 ? 'bg-warning' : 'bg-destructive'}
        />
        <TierSelector team={team} />

        {editing ? (
          <View className="gap-2">
            <Textarea value={draft} onChangeText={setDraft} placeholder="Pick-list notes…" className="min-h-[64px]" />
            <View className="flex-row gap-2">
              <Button variant="ghost" size="sm" label="Cancel" onPress={() => setEditing(false)} className="flex-1" />
              <Button size="sm" label="Save" loading={setNotes.isPending} onPress={onSave} className="flex-1" />
            </View>
          </View>
        ) : team.notes ? (
          <Pressable onPress={() => setEditing(true)} className="rounded-lg bg-muted p-3 active:opacity-80">
            <Text className="text-sm">{team.notes}</Text>
          </Pressable>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            label="Add notes"
            icon={NotebookPen}
            onPress={() => {
              setDraft('');
              setEditing(true);
            }}
            className="self-start"
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function PicklistScreen() {
  const { data: teams, isLoading } = usePicklist();
  const { data: questions } = useCapabilityQuestions(true);

  const [search, setSearch] = React.useState('');
  const [minScore, setMinScore] = React.useState(0);
  const [tierFilter, setTierFilter] = React.useState<PicklistTier | 'untiered' | 'all'>('all');
  const [caps, setCaps] = React.useState<Set<string>>(new Set());
  const [showCapFilter, setShowCapFilter] = React.useState(false);

  const toggleCap = (id: string) =>
    setCaps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = (teams ?? []).filter((t) => {
    const q = search.trim().toLowerCase();
    if (q && !String(t.team_number).includes(q) && !(t.team_name ?? '').toLowerCase().includes(q)) return false;
    if (t.score < minScore) return false;
    if (tierFilter === 'untiered' && t.tier !== null) return false;
    if (tierFilter !== 'all' && tierFilter !== 'untiered' && t.tier !== tierFilter) return false;
    for (const qid of caps) {
      if ((t.capabilities[qid] ?? 0) < 50) return false;
    }
    return true;
  });

  const groups = TIER_GROUP_ORDER.map((key) => ({
    key,
    label: key === 'untiered' ? 'Untiered' : PICKLIST_TIERS.find((t) => t.value === key)!.label,
    teams: filtered
      .filter((t) => (key === 'untiered' ? t.tier === null : t.tier === key))
      .sort((a, b) => b.score - a.score),
  })).filter((g) => g.teams.length > 0);

  return (
    <Screen>
      <ScreenHeader title="Pick-list" description="Tier teams and filter by capability." backHref="/scouting">
        <Button
          variant="outline"
          size="icon"
          icon={SlidersHorizontal}
          accessibilityLabel="Capability filters"
          onPress={() => setShowCapFilter((s) => !s)}
        />
      </ScreenHeader>

      <View className="flex-row items-center gap-2 rounded-lg border border-input bg-background px-3">
        <Icon as={Search} size={18} className="text-muted-foreground" />
        <Input value={search} onChangeText={setSearch} placeholder="Search team" className="h-11 flex-1 border-0 px-0" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
        <Chip label="All tiers" active={tierFilter === 'all'} onPress={() => setTierFilter('all')} />
        {PICKLIST_TIERS.map((t) => (
          <Chip key={t.value} label={t.label} active={tierFilter === t.value} onPress={() => setTierFilter(t.value)} />
        ))}
        <Chip label="Untiered" active={tierFilter === 'untiered'} onPress={() => setTierFilter('untiered')} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-2">
        {SCORE_PRESETS.map((s) => (
          <Chip key={s} label={s === 0 ? 'Any score' : `${s}%+`} active={minScore === s} onPress={() => setMinScore(s)} />
        ))}
      </ScrollView>

      {showCapFilter ? (
        <Card>
          <CardContent className="gap-2 p-4">
            <Text variant="label">Require capability (≥50% yes)</Text>
            <View className="flex-row flex-wrap gap-2">
              {(questions ?? []).map((qn) => (
                <Chip key={qn.id} label={qn.prompt} active={caps.has(qn.id)} onPress={() => toggleCap(qn.id)} />
              ))}
            </View>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title={(teams ?? []).length === 0 ? 'No teams scouted yet' : 'No teams match your filters'}
          description={
            (teams ?? []).length === 0
              ? 'Scout some teams first, then tier them here for alliance selection.'
              : 'Loosen the score or capability filters to see more teams.'
          }
        />
      ) : (
        groups.map((g) => (
          <View key={g.key} className="gap-3">
            <Text variant="title">
              {g.label} ({g.teams.length})
            </Text>
            {g.teams.map((t) => (
              <TeamRow key={t.id} team={t} />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}
