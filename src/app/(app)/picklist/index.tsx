import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { ListOrdered, Search, ListFilter, NotebookPen, ChevronUp, ChevronDown, X } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCapabilityQuestions } from '@/lib/queries/scouting';
import {
  usePicklist,
  useSetTier,
  useReorderTier,
  useSetPicklistNotes,
  type PicklistTeam,
} from '@/lib/queries/picklist';
import { PICKLIST_TIERS, type CapabilityQuestion, type PicklistTier } from '@/lib/types';

type TierKey = PicklistTier | 'untiered';
const TIER_ORDER: TierKey[] = ['tier1', 'tier2', 'tier3', 'untiered', 'dnp'];

const TIER_ACCENT: Record<TierKey, string> = {
  tier1: 'text-success',
  tier2: 'text-primary',
  tier3: 'text-warning',
  untiered: 'text-muted-foreground',
  dnp: 'text-destructive',
};

/** Per-question filter: absent = any. */
type FilterChoice = 'yes' | 'no';
type Filters = Record<string, FilterChoice>;

/** Within a tier: manual rank first (nulls last), then team number. */
function tierSort(a: PicklistTeam, b: PicklistTeam): number {
  if (a.rank !== null && b.rank !== null && a.rank !== b.rank) return a.rank - b.rank;
  if (a.rank !== null && b.rank === null) return -1;
  if (a.rank === null && b.rank !== null) return 1;
  return a.team_number - b.team_number;
}

function matchesFilters(team: PicklistTeam, filters: Filters): boolean {
  for (const [qid, choice] of Object.entries(filters)) {
    const yesPercent = team.capabilities[qid] ?? 0;
    if (choice === 'yes' && yesPercent < 50) return false;
    if (choice === 'no' && yesPercent >= 50) return false;
  }
  return true;
}

function SegmentedChoice({
  value,
  onChange,
}: {
  value: FilterChoice | undefined;
  onChange: (next: FilterChoice | undefined) => void;
}) {
  const options: { label: string; choice: FilterChoice | undefined }[] = [
    { label: 'Any', choice: undefined },
    { label: 'Yes', choice: 'yes' },
    { label: 'No', choice: 'no' },
  ];
  return (
    <View className="flex-row overflow-hidden rounded-sm border border-border">
      {options.map((o) => {
        const active = value === o.choice;
        return (
          <Pressable
            key={o.label}
            onPress={() => onChange(o.choice)}
            className={cn('px-3 py-1.5', active ? 'bg-primary' : 'bg-background active:bg-accent')}
          >
            <Text
              className={cn(
                'text-[11px] font-bold uppercase tracking-wide',
                active ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FilterPanel({
  questions,
  filters,
  setFilters,
  onClose,
}: {
  questions: CapabilityQuestion[];
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  onClose: () => void;
}) {
  // Group by category preserving question order.
  const groups: { category: string; questions: CapabilityQuestion[] }[] = [];
  for (const q of questions) {
    let g = groups.find((x) => x.category === q.category);
    if (!g) {
      g = { category: q.category, questions: [] };
      groups.push(g);
    }
    g.questions.push(q);
  }

  const setChoice = (qid: string, choice: FilterChoice | undefined) =>
    setFilters((prev) => {
      const next = { ...prev };
      if (choice === undefined) delete next[qid];
      else next[qid] = choice;
      return next;
    });

  return (
    <Card>
      <CardContent className="gap-4 p-4">
        <View className="flex-row items-center justify-between">
          <Text variant="label" className="text-muted-foreground">
            Filters
          </Text>
          <View className="flex-row items-center gap-2">
            {Object.keys(filters).length > 0 ? (
              <Button variant="ghost" size="sm" label="Clear all" onPress={() => setFilters({})} />
            ) : null}
            <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Close filters" onPress={onClose} />
          </View>
        </View>
        {groups.length === 0 ? (
          <Text variant="muted">No capability questions defined yet.</Text>
        ) : (
          groups.map((g) => (
            <View key={g.category} className="gap-2.5">
              <Text variant="label" className="text-primary">
                {g.category}
              </Text>
              {g.questions.map((q) => (
                <View key={q.id} className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-sm">{q.prompt}</Text>
                  <SegmentedChoice value={filters[q.id]} onChange={(c) => setChoice(q.id, c)} />
                </View>
              ))}
            </View>
          ))
        )}
      </CardContent>
    </Card>
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
              'flex-1 items-center rounded-sm border py-1.5',
              active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
            )}
          >
            <Text
              className={cn(
                'text-xs font-bold uppercase tracking-wide',
                active ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              {t.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TeamRow({
  team,
  index,
  tierMates,
}: {
  team: PicklistTeam;
  /** Position of this team within the full (unfiltered) tier list. */
  index: number;
  /** The full ordered list of teams in this tier, for reordering. */
  tierMates: PicklistTeam[];
}) {
  const setNotes = useSetPicklistNotes();
  const reorder = useReorderTier();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(team.notes ?? '');

  const onSave = async () => {
    await setNotes.mutateAsync({ teamId: team.id, notes: draft.trim() });
    setEditing(false);
  };

  const move = (dir: -1 | 1) => {
    const next = [...tierMates];
    const from = next.findIndex((t) => t.id === team.id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    reorder.mutate(next.map((t, i) => ({ teamId: t.id, rank: i + 1 })));
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <View className="items-center gap-0.5">
            <Pressable
              disabled={reorder.isPending || index === 0}
              onPress={() => move(-1)}
              className={cn(
                'h-7 w-7 items-center justify-center rounded-sm border border-border active:bg-accent',
                index === 0 && 'opacity-30'
              )}
            >
              <Icon as={ChevronUp} size={16} className="text-muted-foreground" />
            </Pressable>
            <Pressable
              disabled={reorder.isPending || index === tierMates.length - 1}
              onPress={() => move(1)}
              className={cn(
                'h-7 w-7 items-center justify-center rounded-sm border border-border active:bg-accent',
                index === tierMates.length - 1 && 'opacity-30'
              )}
            >
              <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
            </Pressable>
          </View>
          <Link href={`/scouting/pit/${team.id}` as any} asChild>
            <Pressable className="flex-1 flex-row items-center gap-3 active:opacity-80">
              <View className="items-center justify-center rounded-sm border border-border bg-background px-2.5 py-1.5">
                <Text className="text-xs font-bold text-muted-foreground">#{index + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-bold">Team {team.team_number}</Text>
                <Text variant="muted" numberOfLines={1}>
                  {team.team_name ?? 'Unknown name'}
                </Text>
              </View>
              <Badge
                variant="muted"
                label={`${team.entry_count} ${team.entry_count === 1 ? 'report' : 'reports'}`}
              />
            </Pressable>
          </Link>
        </View>

        <TierSelector team={team} />

        {editing ? (
          <View className="gap-2">
            <Textarea value={draft} onChangeText={setDraft} placeholder="Picklist notes…" className="min-h-[64px]" />
            <View className="flex-row gap-2">
              <Button variant="ghost" size="sm" label="Cancel" onPress={() => setEditing(false)} className="flex-1" />
              <Button size="sm" label="Save" loading={setNotes.isPending} onPress={onSave} className="flex-1" />
            </View>
          </View>
        ) : team.notes ? (
          <Pressable onPress={() => setEditing(true)} className="rounded-md bg-muted p-3 active:opacity-80">
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
  const [filters, setFilters] = React.useState<Filters>({});
  const [showFilters, setShowFilters] = React.useState(false);

  const filterCount = Object.keys(filters).length;

  // Full per-tier ordering (independent of search/filters) so manual
  // reordering always works against the complete tier.
  const tierLists = React.useMemo(() => {
    const map = new Map<TierKey, PicklistTeam[]>();
    for (const key of TIER_ORDER) map.set(key, []);
    for (const t of teams ?? []) map.get(t.tier ?? 'untiered')!.push(t);
    for (const key of TIER_ORDER) map.get(key)!.sort(tierSort);
    return map;
  }, [teams]);

  const visible = (t: PicklistTeam) => {
    const q = search.trim().toLowerCase();
    if (q && !String(t.team_number).includes(q) && !(t.team_name ?? '').toLowerCase().includes(q)) return false;
    return matchesFilters(t, filters);
  };

  const groups = TIER_ORDER.map((key) => {
    const all = tierLists.get(key)!;
    return {
      key,
      label: key === 'untiered' ? 'Untiered' : PICKLIST_TIERS.find((t) => t.value === key)!.label,
      all,
      shown: all.map((team, index) => ({ team, index })).filter(({ team }) => visible(team)),
    };
  }).filter((g) => g.all.length > 0);

  const anyShown = groups.some((g) => g.shown.length > 0);

  return (
    <Screen>
      <ScreenHeader title="Picklist" description="Tier teams manually for alliance selection.">
        <Button
          variant={filterCount > 0 ? 'default' : 'outline'}
          size="sm"
          icon={ListFilter}
          label={filterCount > 0 ? `Filters · ${filterCount}` : 'Filter'}
          accessibilityLabel="Capability filters"
          onPress={() => setShowFilters((s) => !s)}
        />
      </ScreenHeader>

      <View className="flex-row items-center gap-2 rounded-md border border-input bg-background px-3">
        <Icon as={Search} size={18} className="text-muted-foreground" />
        <Input value={search} onChangeText={setSearch} placeholder="Search teams" className="h-11 flex-1 border-0 px-0" />
      </View>

      {showFilters ? (
        <FilterPanel
          questions={questions ?? []}
          filters={filters}
          setFilters={setFilters}
          onClose={() => setShowFilters(false)}
        />
      ) : null}

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : !anyShown ? (
        <EmptyState
          icon={ListOrdered}
          title={(teams ?? []).length === 0 ? 'No teams scouted yet' : 'No teams match'}
          description={
            (teams ?? []).length === 0
              ? 'Scout some teams first, then place them into tiers here.'
              : 'Loosen the search or capability filters to see more teams.'
          }
        />
      ) : (
        groups
          .filter((g) => g.shown.length > 0)
          .map((g) => (
            <View key={g.key} className="gap-3">
              <View className="flex-row items-center gap-2">
                <Text variant="label" className={TIER_ACCENT[g.key]}>
                  {g.label}
                </Text>
                <Badge variant="muted" label={String(g.shown.length)} />
              </View>
              {g.shown.map(({ team, index }) => (
                <TeamRow key={team.id} team={team} index={index} tierMates={g.all} />
              ))}
            </View>
          ))
      )}
    </Screen>
  );
}
