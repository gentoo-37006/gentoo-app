import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from 'react-native-reanimated';
import {
  ListOrdered,
  Search,
  ListFilter,
  NotebookPen,
  ChevronRight,
  GripVertical,
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
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useCapabilityQuestions } from '@/lib/queries/scouting';
import { usePicklist, useMoveTeam, useSetPicklistNotes, type PicklistTeam } from '@/lib/queries/picklist';
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

/** Layout constants for drop targeting on narrow (horizontally scrolled) boards. */
const NARROW_COL_WIDTH = 288; // w-72
const COL_GAP = 12; // gap-3
const BOARD_PAD = 16; // px-4
const COL_HEADER_HEIGHT = 42;

const grabCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined;

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
 * Two-pane popup: category list on the left; hovering (or tapping) a category
 * reveals its questions (Any/Yes/No) on the right. Nothing shows until hover.
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
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const active = groups.find((g) => g.category === activeCategory);

  const setChoice = (qid: string, choice: FilterChoice | undefined) =>
    setFilters((prev) => {
      const next = { ...prev };
      if (choice === undefined) delete next[qid];
      else next[qid] = choice;
      return next;
    });

  return (
    <View className="flex-row rounded-md border border-border bg-popover">
      {groups.length === 0 ? (
        <View className="p-4">
          <Text variant="muted">No capability questions defined yet.</Text>
        </View>
      ) : (
        <>
          <View className="w-44 p-1">
            {groups.map((g) => {
              const selected = g.category === activeCategory;
              const n = g.questions.filter((q) => filters[q.id]).length;
              return (
                <Pressable
                  key={g.category}
                  onHoverIn={() => setActiveCategory(g.category)}
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
          {active ? (
            <View className="w-80 gap-3 border-l border-border p-3">
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
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

type CardLayout = { y: number; h: number };

function TeamCard({
  team,
  index,
  highlight,
  onDragStart,
  onDragMove,
  onDragEnd,
  onLayoutCard,
  dragging,
}: {
  team: PicklistTeam;
  index: number;
  /** null = no filters active; true = matches; false = doesn't match. */
  highlight: boolean | null;
  onDragStart: (team: PicklistTeam, absX: number, absY: number) => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: (team: PicklistTeam, absX: number, absY: number) => void;
  onLayoutCard: (teamId: string, layout: CardLayout) => void;
  dragging: boolean;
}) {
  const router = useRouter();
  const setNotes = useSetPicklistNotes();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(team.notes ?? '');

  const onSave = async () => {
    await setNotes.mutateAsync({ teamId: team.id, notes: draft.trim() });
    setEditing(false);
  };

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(150)
        .onStart((e) => {
          runOnJS(onDragStart)(team, e.absoluteX, e.absoluteY);
        })
        .onUpdate((e) => {
          runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
        })
        .onEnd((e) => {
          runOnJS(onDragEnd)(team, e.absoluteX, e.absoluteY);
        })
        .onTouchesCancelled(() => {
          runOnJS(onDragEnd)(team, -1, -1);
        }),
    [team, onDragStart, onDragMove, onDragEnd]
  );

  return (
    <View onLayout={(e) => onLayoutCard(team.id, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}>
      <GestureDetector gesture={pan}>
        <View
          className={cn(
            'gap-2 rounded-md border bg-background p-2.5',
            highlight === true ? 'border-success' : 'border-border',
            highlight === false && 'opacity-40',
            dragging && 'opacity-30'
          )}
        >
          <View className="flex-row items-start gap-2">
            <View style={grabCursor} className="pt-0.5">
              <Icon as={GripVertical} size={14} className="text-muted-foreground" />
            </View>
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
            <Pressable
              accessibilityLabel="Edit notes"
              onPress={() => {
                setDraft(team.notes ?? '');
                setEditing((s) => !s);
              }}
              className="h-6 w-6 items-center justify-center rounded-sm active:bg-accent"
            >
              <Icon as={NotebookPen} size={13} className="text-muted-foreground" />
            </Pressable>
          </View>

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
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

export default function PicklistScreen() {
  const { data: teams, isLoading } = usePicklist();
  const { data: questions } = useCapabilityQuestions(true);
  const moveTeam = useMoveTeam();
  const { isWide } = useBreakpoint();

  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState<Filters>({});
  const [showFilters, setShowFilters] = React.useState(false);
  const [popupPos, setPopupPos] = React.useState<{ left: number; top: number } | null>(null);

  const filterCount = Object.keys(filters).length;
  const questionById = new Map((questions ?? []).map((q) => [q.id, q]));

  // Full per-tier ordering (independent of search) so drops always land in
  // the complete tier list.
  const tierLists = React.useMemo(() => {
    const map = new Map<TierKey, PicklistTeam[]>();
    for (const key of TIER_ORDER) map.set(key, []);
    for (const t of teams ?? []) map.get(t.tier ?? 'untiered')!.push(t);
    for (const key of TIER_ORDER) map.get(key)!.sort(tierSort);
    return map;
  }, [teams]);

  // Search hides; filters only highlight (matches green, misses dimmed).
  const searchVisible = React.useCallback(
    (t: PicklistTeam) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return String(t.team_number).includes(q) || (t.team_name ?? '').toLowerCase().includes(q);
    },
    [search]
  );

  const columns = TIER_ORDER.map((key) => {
    const all = tierLists.get(key)!;
    return {
      key,
      all,
      shown: all.map((team, index) => ({ team, index })).filter(({ team }) => searchVisible(team)),
    };
  });

  // ---- Filter popup anchoring --------------------------------------------------

  const rootRef = React.useRef<View>(null);
  const rootRect = React.useRef({ x: 0, y: 0 });
  const filterBtnRef = React.useRef<View>(null);
  // Shared-value mirror of rootRect, read by the drag overlay's animated style.
  const rootOrigin = useSharedValue({ x: 0, y: 0 });

  const measureRoot = React.useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      rootRect.current = { x, y };
      rootOrigin.value = { x, y };
    });
  }, [rootOrigin]);

  const toggleFilters = () => {
    if (showFilters) {
      setShowFilters(false);
      return;
    }
    filterBtnRef.current?.measureInWindow((x, y, _w, h) => {
      setPopupPos({ left: x - rootRect.current.x, top: y - rootRect.current.y + h + 4 });
      setShowFilters(true);
    });
  };

  // ---- Drag & drop ------------------------------------------------------------

  const [dragTeam, setDragTeam] = React.useState<PicklistTeam | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const boardRef = React.useRef<View>(null);
  const boardRect = React.useRef({ x: 0, y: 0, w: 0, h: 0 });
  const hScroll = React.useRef(0);
  const vScroll = React.useRef<Record<string, number>>({});
  const cardLayouts = React.useRef(new Map<string, CardLayout>());

  const measureBoard = React.useCallback(() => {
    boardRef.current?.measureInWindow((x, y, w, h) => {
      boardRect.current = { x, y, w, h };
    });
  }, []);

  const onLayoutCard = React.useCallback((teamId: string, layout: CardLayout) => {
    cardLayouts.current.set(teamId, layout);
  }, []);

  // Reanimated shared values are mutable containers written from gesture
  // callbacks; the compiler's immutability/deps rules don't model that, so
  // the writes and depless callbacks below carry targeted disables.
  const onDragStart = React.useCallback(
    (team: PicklistTeam, absX: number, absY: number) => {
      measureRoot();
      measureBoard();
      dragX.value = absX;
      dragY.value = absY;
      setDragTeam(team);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measureRoot, measureBoard]
  );

  const onDragMove = React.useCallback((absX: number, absY: number) => {
    // eslint-disable-next-line react-hooks/immutability
    dragX.value = absX;
    // eslint-disable-next-line react-hooks/immutability
    dragY.value = absY;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Map a drop point to a tier column + insertion index, then persist. */
  const onDragEnd = React.useCallback(
    (team: PicklistTeam, absX: number, absY: number) => {
      setDragTeam(null);
      if (absX < 0) return; // cancelled
      const board = boardRect.current;
      if (board.w === 0 || absY < board.y || absY > board.y + board.h) return;

      const relX = absX - board.x;
      let colIndex: number;
      if (isWide) {
        const colWidth = board.w / TIER_ORDER.length;
        colIndex = Math.floor(relX / colWidth);
      } else {
        const scrolled = relX + hScroll.current - BOARD_PAD;
        colIndex = Math.floor(scrolled / (NARROW_COL_WIDTH + COL_GAP));
      }
      if (colIndex < 0 || colIndex >= TIER_ORDER.length) return;

      const targetKey = TIER_ORDER[colIndex];
      const targetTier: PicklistTier | null = targetKey === 'untiered' ? null : targetKey;
      const fullList = tierLists.get(targetKey)!.filter((t) => t.id !== team.id);
      const shownList = fullList.filter(searchVisible);

      // Insertion point from the drop Y against the visible cards' layouts.
      const contentY = absY - board.y - COL_HEADER_HEIGHT + (vScroll.current[targetKey] ?? 0);
      let insertBefore: PicklistTeam | undefined;
      for (const t of shownList) {
        const layout = cardLayouts.current.get(t.id);
        if (layout && contentY < layout.y + layout.h / 2) {
          insertBefore = t;
          break;
        }
      }

      const orderedIds = fullList.map((t) => t.id);
      const at = insertBefore ? orderedIds.indexOf(insertBefore.id) : orderedIds.length;
      orderedIds.splice(at, 0, team.id);

      const sameTier = (team.tier ?? 'untiered') === targetKey;
      const oldIndex = tierLists.get(targetKey)!.findIndex((t) => t.id === team.id);
      if (sameTier && oldIndex === at) return; // no-op drop

      moveTeam.mutate({ teamId: team.id, tier: targetTier, orderedIds });
    },
    [isWide, tierLists, searchVisible, moveTeam]
  );

  const ghostStyle = useAnimatedStyle(() => ({
    left: dragX.value - rootOrigin.value.x - 120,
    top: dragY.value - rootOrigin.value.y - 30,
  }));

  // ---- Render -------------------------------------------------------------------

  const renderColumn = (col: (typeof columns)[number]) => (
    <View
      key={col.key}
      className={cn('h-full rounded-md border border-border bg-card', isWide ? 'flex-1' : 'w-72')}
    >
      <View className="flex-row items-center gap-2 border-b border-border px-3 py-2.5">
        <View className={cn('h-2 w-2 rounded-none', TIER_DOT[col.key])} />
        <Text variant="label">{tierLabel(col.key)}</Text>
        <Badge variant="muted" label={String(col.shown.length)} />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 p-2"
        scrollEnabled={!dragTeam}
        onScroll={(e) => {
          vScroll.current[col.key] = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
      >
        {col.shown.length === 0 ? (
          <View className="items-center py-8">
            <Text variant="small">No teams</Text>
          </View>
        ) : (
          col.shown.map(({ team, index }) => (
            <TeamCard
              key={team.id}
              team={team}
              index={index}
              highlight={filterCount > 0 ? matchesFilters(team, filters) : null}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onLayoutCard={onLayoutCard}
              dragging={dragTeam?.id === team.id}
            />
          ))
        )}
      </ScrollView>
    </View>
  );

  return (
    <View ref={rootRef} onLayout={measureRoot} className="flex-1 bg-background">
      <View className="gap-3 px-4 pb-3 pt-5 md:px-6">
        <View className="flex-row items-center gap-2.5">
          <Text variant="h2">Picklist</Text>
          <Badge variant="default" label={String((teams ?? []).length)} />
        </View>

        <View className="flex-row items-center gap-2">
          <View className="h-10 max-w-md flex-1 flex-row items-center gap-2 rounded-md border border-input bg-background px-3">
            <Icon as={Search} size={18} className="text-muted-foreground" />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search teams…"
              className="h-full flex-1 border-0 px-0"
            />
          </View>
          <View ref={filterBtnRef} collapsable={false}>
            <Button
              variant={showFilters || filterCount > 0 ? 'default' : 'outline'}
              size="sm"
              icon={ListFilter}
              label="Filter"
              accessibilityLabel="Capability filters"
              onPress={toggleFilters}
            />
          </View>
          {filterCount > 0 ? (
            <Button variant="ghost" size="sm" label="Clear all" onPress={() => setFilters({})} />
          ) : null}
        </View>

        {filterCount > 0 ? (
          <View className="flex-row flex-wrap items-center gap-2">
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
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (teams ?? []).length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="No teams scouted yet"
          description="Scout some teams first, then drag them into tiers here."
        />
      ) : isWide ? (
        <View ref={boardRef} onLayout={measureBoard} className="flex-1 flex-row gap-3 px-6 pb-4">
          {columns.map(renderColumn)}
        </View>
      ) : (
        <View ref={boardRef} onLayout={measureBoard} className="flex-1">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-1"
            contentContainerClassName="gap-3 px-4 pb-4"
            scrollEnabled={!dragTeam}
            onScroll={(e) => {
              hScroll.current = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={32}
          >
            {columns.map(renderColumn)}
          </ScrollView>
        </View>
      )}

      {/* Click-away backdrop + popup live at the root so they stack above
          everything (including the header) on both web and native. */}
      {showFilters ? (
        <>
          <Pressable
            accessibilityLabel="Close filters"
            className="absolute bottom-0 left-0 right-0 top-0 z-30"
            onPress={() => setShowFilters(false)}
          />
          {popupPos ? (
            <View className="absolute z-40" style={popupPos}>
              <FilterPopup questions={questions ?? []} filters={filters} setFilters={setFilters} />
            </View>
          ) : null}
        </>
      ) : null}

      {/* Ghost card that follows the pointer while dragging. */}
      {dragTeam ? (
        <Animated.View
          pointerEvents="none"
          style={ghostStyle}
          className="absolute z-50 w-[240px] gap-1 rounded-md border border-primary bg-card p-2.5 opacity-95"
        >
          <View className="flex-row items-center gap-2">
            <Icon as={GripVertical} size={14} className="text-muted-foreground" />
            <Text className="text-base font-extrabold">#{dragTeam.team_number}</Text>
          </View>
          <Text variant="small" numberOfLines={1}>
            {dragTeam.team_name ?? 'Unknown name'}
          </Text>
          {dragTeam.notes ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {dragTeam.notes}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
