import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ListOrdered,
  Search,
  ListFilter,
  NotebookPen,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { EmptyState } from '@/components/ui/empty-state';
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
const TIER_ORDER: TierKey[] = ['tier1', 'tier2', 'tier3', 'dnp', 'untiered'];

const TIER_DOT: Record<TierKey, string> = {
  tier1: 'bg-success',
  tier2: 'bg-primary',
  tier3: 'bg-warning',
  dnp: 'bg-destructive',
  untiered: 'bg-muted-foreground',
};

function tierLabel(key: TierKey): string {
  return key === 'untiered' ? 'Uncategorized' : PICKLIST_TIERS.find((t) => t.value === key)!.label;
}

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

function groupByCategory(questions: CapabilityQuestion[]) {
  const groups: { category: string; questions: CapabilityQuestion[] }[] = [];
  for (const q of questions) {
    let g = groups.find((x) => x.category === q.category);
    if (!g) {
      g = { category: q.category, questions: [] };
      groups.push(g);
    }
    g.questions.push(q);
  }
  return groups;
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
            className={cn('px-2.5 py-1', active ? 'bg-primary' : 'bg-background active:bg-accent')}
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

/**
 * Two-pane popup anchored under the toolbar: category list on the left, the
 * selected category's questions (Any/Yes/No) on the right.
 */
function FilterPopup({
  questions,
  filters,
  setFilters,
}: {
  questions: CapabilityQuestion[];
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  const groups = groupByCategory(questions);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(
    groups[0]?.category ?? null
  );
  const active = groups.find((g) => g.category === activeCategory);

  const setChoice = (qid: string, choice: FilterChoice | undefined) =>
    setFilters((prev) => {
      const next = { ...prev };
      if (choice === undefined) delete next[qid];
      else next[qid] = choice;
      return next;
    });

  const countIn = (g: { questions: CapabilityQuestion[] }) =>
    g.questions.filter((q) => filters[q.id]).length;

  return (
    <View className="absolute left-0 right-0 top-full z-50 mt-1 flex-row rounded-md border border-border bg-popover md:right-auto md:w-[520px]">
      {groups.length === 0 ? (
        <View className="p-4">
          <Text variant="muted">No capability questions defined yet.</Text>
        </View>
      ) : (
        <>
          <View className="w-44 border-r border-border p-1">
            {groups.map((g) => {
              const selected = g.category === activeCategory;
              const n = countIn(g);
              return (
                <Pressable
                  key={g.category}
                  onPress={() => setActiveCategory(g.category)}
                  className={cn(
                    'flex-row items-center gap-1.5 rounded-sm px-2.5 py-2',
                    selected ? 'bg-accent' : 'active:bg-accent'
                  )}
                >
                  <Text className="flex-1 text-[13px] font-semibold" numberOfLines={1}>
                    {g.category}
                  </Text>
                  {n > 0 ? <Badge variant="default" label={String(n)} /> : null}
                  <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
                </Pressable>
              );
            })}
          </View>
          <View className="flex-1 gap-3 p-3">
            {active ? (
              <>
                <Text variant="label" className="text-muted-foreground">
                  {active.category}
                </Text>
                {active.questions.map((q) => (
                  <View key={q.id} className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm" numberOfLines={2}>
                      {q.prompt}
                    </Text>
                    <SegmentedChoice value={filters[q.id]} onChange={(c) => setChoice(q.id, c)} />
                  </View>
                ))}
              </>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function TierSelector({ team }: { team: PicklistTeam }) {
  const setTier = useSetTier();
  return (
    <View className="flex-row gap-1">
      {PICKLIST_TIERS.map((t) => {
        const active = team.tier === t.value;
        return (
          <Pressable
            key={t.value}
            disabled={setTier.isPending}
            onPress={() => setTier.mutate({ teamId: team.id, tier: active ? null : t.value })}
            className={cn(
              'flex-1 items-center rounded-sm border py-1',
              active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
            )}
          >
            <Text
              className={cn(
                'text-[10px] font-bold uppercase tracking-wide',
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

function TeamCard({
  team,
  index,
  tierMates,
}: {
  team: PicklistTeam;
  /** Position within the full (unfiltered) tier list. */
  index: number;
  /** Full ordered tier list, for reordering. */
  tierMates: PicklistTeam[];
}) {
  const router = useRouter();
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
    <View className="gap-2 rounded-md border border-border bg-background p-2.5">
      <View className="flex-row items-center gap-2.5">
        <Pressable
          className="flex-1 active:opacity-75"
          onPress={() => router.push(`/scouting/pit/${team.id}` as any)}
        >
          <Text className="text-base font-extrabold">#{team.team_number}</Text>
          <Text variant="small" numberOfLines={1}>
            {team.team_name ?? 'Unknown name'}
          </Text>
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            idx: {index + 1} | reports: {team.entry_count}
          </Text>
        </Pressable>
        <View className="gap-1">
          <Pressable
            disabled={reorder.isPending || index === 0}
            onPress={() => move(-1)}
            className={cn(
              'h-6 w-6 items-center justify-center rounded-sm border border-border active:bg-accent',
              index === 0 && 'opacity-30'
            )}
          >
            <Icon as={ChevronUp} size={14} className="text-muted-foreground" />
          </Pressable>
          <Pressable
            disabled={reorder.isPending || index === tierMates.length - 1}
            onPress={() => move(1)}
            className={cn(
              'h-6 w-6 items-center justify-center rounded-sm border border-border active:bg-accent',
              index === tierMates.length - 1 && 'opacity-30'
            )}
          >
            <Icon as={ChevronDown} size={14} className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>

      <TierSelector team={team} />

      {editing ? (
        <View className="gap-2">
          <Textarea
            value={draft}
            onChangeText={setDraft}
            placeholder="Picklist notes…"
            className="min-h-[56px] p-2 text-sm"
          />
          <View className="flex-row gap-2">
            <Button variant="ghost" size="sm" label="Cancel" onPress={() => setEditing(false)} className="flex-1" />
            <Button size="sm" label="Save" loading={setNotes.isPending} onPress={onSave} className="flex-1" />
          </View>
        </View>
      ) : team.notes ? (
        <Pressable onPress={() => setEditing(true)} className="rounded-sm bg-muted px-2 py-1.5 active:opacity-80">
          <Text className="text-xs" numberOfLines={2}>
            {team.notes}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            setDraft('');
            setEditing(true);
          }}
          className="flex-row items-center gap-1.5 self-start rounded-sm px-1 py-0.5 active:bg-accent"
        >
          <Icon as={NotebookPen} size={12} className="text-muted-foreground" />
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Add note
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function PicklistScreen() {
  const { data: teams, isLoading } = usePicklist();
  const { data: questions } = useCapabilityQuestions(true);

  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState<Filters>({});
  const [showFilters, setShowFilters] = React.useState(false);

  const filterCount = Object.keys(filters).length;
  const questionById = new Map((questions ?? []).map((q) => [q.id, q]));

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

  const columns = TIER_ORDER.map((key) => {
    const all = tierLists.get(key)!;
    return {
      key,
      all,
      shown: all.map((team, index) => ({ team, index })).filter(({ team }) => visible(team)),
    };
  });

  return (
    <View className="flex-1 bg-background">
      <View className="gap-3 px-4 pb-3 pt-5 md:px-6">
        <View className="flex-row items-center gap-2.5">
          <Text variant="h2">Picklist</Text>
          <Badge variant="default" label={String((teams ?? []).length)} />
        </View>

        <View className="h-11 max-w-md flex-row items-center gap-2 rounded-md border border-input bg-background px-3">
          <Icon as={Search} size={18} className="text-muted-foreground" />
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search teams…"
            className="h-full flex-1 border-0 px-0"
          />
        </View>

        {/* Toolbar anchors the filter popup; keep it above the backdrop. */}
        <View className="relative z-50 flex-row flex-wrap items-center gap-2">
          <Button
            variant={showFilters || filterCount > 0 ? 'default' : 'outline'}
            size="sm"
            icon={ListFilter}
            label="Filter"
            accessibilityLabel="Capability filters"
            onPress={() => setShowFilters((s) => !s)}
          />
          {filterCount > 0 ? (
            <Button variant="ghost" size="sm" label="Clear all" onPress={() => setFilters({})} />
          ) : null}
          {Object.entries(filters).map(([qid, choice]) => {
            const q = questionById.get(qid);
            if (!q) return null;
            return (
              <Pressable
                key={qid}
                onPress={() =>
                  setFilters((prev) => {
                    const next = { ...prev };
                    delete next[qid];
                    return next;
                  })
                }
                className="flex-row items-center gap-1.5 rounded-sm border border-primary bg-primary/10 px-2 py-1 active:opacity-70"
              >
                <Text className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  {q.prompt}: {choice}
                </Text>
                <Icon as={X} size={12} className="text-primary" />
              </Pressable>
            );
          })}

          {showFilters ? (
            <FilterPopup questions={questions ?? []} filters={filters} setFilters={setFilters} />
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (teams ?? []).length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="No teams scouted yet"
          description="Scout some teams first, then place them into tiers here."
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-1"
          contentContainerClassName="gap-3 px-4 pb-4 md:px-6"
        >
          {columns.map((col) => (
            <View key={col.key} className="h-full w-72 rounded-md border border-border bg-card">
              <View className="flex-row items-center gap-2 border-b border-border px-3 py-2.5">
                <View className={cn('h-2 w-2 rounded-none', TIER_DOT[col.key])} />
                <Text variant="label">{tierLabel(col.key)}</Text>
                <Badge variant="muted" label={String(col.shown.length)} />
              </View>
              <ScrollView className="flex-1" contentContainerClassName="gap-2 p-2">
                {col.shown.length === 0 ? (
                  <View className="items-center py-8">
                    <Text variant="small">No teams</Text>
                  </View>
                ) : (
                  col.shown.map(({ team, index }) => (
                    <TeamCard key={team.id} team={team} index={index} tierMates={col.all} />
                  ))
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Click-away backdrop for the filter popup. */}
      {showFilters ? (
        <Pressable
          accessibilityLabel="Close filters"
          className="absolute bottom-0 left-0 right-0 top-0 z-40"
          onPress={() => setShowFilters(false)}
        />
      ) : null}
    </View>
  );
}
