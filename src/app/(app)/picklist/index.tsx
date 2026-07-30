import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  ListOrdered,
  Search,
  ListFilter,
  ChevronRight,
  Swords,
  X,
} from 'lucide-react-native';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MOBILE_DRAG_HOLD_MS } from '@/components/mobile-drag-surface';
import { useDragOverlay } from '@/components/drag-overlay';
import { cn } from '@/lib/utils';
import { useColorScheme } from '@/lib/theme';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useCapabilityQuestions } from '@/lib/queries/scouting';
import { FacemashModal } from '@/components/facemash';
import {
  usePicklist,
  useMoveTeam,
  useSetPicklistNotes,
  tierSort,
  type PicklistTeam,
} from '@/lib/queries/picklist';
import { tierLabel, type CapabilityQuestion, type PicklistTier, type TierKey } from '@/lib/types';

const TIER_ORDER: TierKey[] = ['tier1', 'tier2', 'tier3', 'dnp', 'untiered'];

const TIER_DOT: Record<TierKey, string> = {
  tier1: 'bg-success',
  tier2: 'bg-primary',
  tier3: 'bg-warning',
  dnp: 'bg-destructive',
  untiered: 'bg-muted-foreground',
};

const COL_HEADER_HEIGHT = 42;
const NOTES_MIN_HEIGHT = 28;
const NOTES_MAX_HEIGHT = 60;

function resizeWebNotes(element: HTMLTextAreaElement) {
  element.style.height = '0px';
  const contentHeight = element.scrollHeight;
  const height = Math.min(
    Math.max(contentHeight, NOTES_MIN_HEIGHT),
    NOTES_MAX_HEIGHT
  );
  element.style.height = `${height}px`;
  element.style.overflowY = contentHeight > NOTES_MAX_HEIGHT ? 'auto' : 'hidden';
  if (contentHeight <= NOTES_MAX_HEIGHT) element.scrollTop = 0;
}

/** Per-question filter: absent = any. */
type FilterChoice = 'yes' | 'no';
type Filters = Record<string, FilterChoice>;

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

type CardLayout = { y: number; w: number; h: number };
type ColumnLayout = { x: number; y: number; w: number; h: number };
type DropTarget = {
  tierKey: TierKey;
  markerIndex: number;
  insertBeforeTeamId: string | null;
  dimContents?: boolean;
};
type WebPointerDrag = {
  team: PicklistTeam;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  sourceElement: HTMLElement;
  ghost: HTMLElement | null;
  line: HTMLElement | null;
  dimmedList: HTMLElement | null;
  target: DropTarget | null;
  moveListener: ((event: PointerEvent) => void) | null;
  endListener: ((event: PointerEvent) => void) | null;
  cancelListener: ((event: PointerEvent) => void) | null;
};

function PicklistTeamGhost({
  team,
  index,
  highlight,
}: {
  team: PicklistTeam;
  index: number;
  highlight: boolean | null;
}) {
  const notes = team.notes ?? '';
  const noteLines = Math.min(3, Math.max(1, notes.split('\n').length));

  return (
    <View
      className={cn(
        'gap-2 rounded-md border bg-background p-2.5',
        highlight === true ? 'border-success' : 'border-border',
        highlight === false && 'opacity-40'
      )}
    >
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <Text className="text-base font-extrabold">#{team.team_number}</Text>
          <Text variant="small" numberOfLines={1}>
            {team.team_name ?? 'Unknown name'}
          </Text>
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            idx: {index + 1} | reports: {team.entry_count}
          </Text>
        </View>
      </View>
      <View
        className="min-h-[28px] max-h-[60px] justify-center rounded-sm bg-muted px-2 py-1.5"
        style={{ height: 28 + (noteLines - 1) * 16 }}
      >
        <Text
          className={cn(
            'text-xs leading-4',
            notes ? 'text-foreground' : 'text-muted-foreground'
          )}
          numberOfLines={3}
        >
          {notes || 'Picklist notes...'}
        </Text>
      </View>
    </View>
  );
}

function TeamCard({
  team,
  index,
  highlight,
  onDragStart,
  onDragMove,
  onDragEnd,
  onLayoutCard,
  dragX,
  dragY,
  dragging,
  indicatorBefore,
  indicatorAfter,
}: {
  team: PicklistTeam;
  index: number;
  /** null = no filters active; true = matches; false = doesn't match. */
  highlight: boolean | null;
  onDragStart: (
    team: PicklistTeam,
    absX: number,
    absY: number,
    localX: number,
    localY: number
  ) => void;
  onDragMove: (team: PicklistTeam, absX: number, absY: number) => void;
  onDragEnd: (team: PicklistTeam, absX: number, absY: number) => void;
  onLayoutCard: (teamId: string, layout: CardLayout) => void;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  dragging: boolean;
  indicatorBefore?: boolean;
  indicatorAfter?: boolean;
}) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const setNotes = useSetPicklistNotes();
  const [draft, setDraft] = React.useState(team.notes ?? '');
  const [notesFocused, setNotesFocused] = React.useState(false);
  const [notesContentHeight, setNotesContentHeight] = React.useState(NOTES_MIN_HEIGHT);
  const [notesScrollReady, setNotesScrollReady] = React.useState(false);
  const measuredNotesHeight = React.useRef(NOTES_MIN_HEIGHT);
  const notesInputRef = React.useRef<React.ElementRef<typeof Textarea>>(null);
  const notesSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !notesInputRef.current) return;
    resizeWebNotes(notesInputRef.current as unknown as HTMLTextAreaElement);
  }, []);

  React.useEffect(() => {
    if (notesContentHeight <= NOTES_MAX_HEIGHT || notesScrollReady) return;
    const frame = requestAnimationFrame(() => setNotesScrollReady(true));
    return () => cancelAnimationFrame(frame);
  }, [notesContentHeight, notesScrollReady]);

  React.useEffect(
    () => () => {
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    },
    []
  );

  const commitNotes = (value: string) => {
    const notes = value.trim();
    if (notes !== (team.notes ?? '')) setNotes.mutate({ teamId: team.id, notes });
  };
  const changeNotes = (value: string) => {
    setDraft(value);
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    if (value.trim() === (team.notes ?? '')) {
      notesSaveTimer.current = null;
      return;
    }
    notesSaveTimer.current = setTimeout(() => {
      notesSaveTimer.current = null;
      commitNotes(value);
    }, 600);
  };
  const flushNotes = () => {
    if (!notesSaveTimer.current) return;
    clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = null;
    commitNotes(draft);
  };
  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(Platform.OS !== 'web' && !notesFocused)
        .activateAfterLongPress(MOBILE_DRAG_HOLD_MS)
        .onStart((e) => {
          runOnJS(onDragStart)(team, e.absoluteX, e.absoluteY, e.x, e.y);
        })
        .onUpdate((e) => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
          dragX.value = e.absoluteX;
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
          dragY.value = e.absoluteY;
          runOnJS(onDragMove)(team, e.absoluteX, e.absoluteY);
        })
        .onEnd((e) => {
          runOnJS(onDragEnd)(team, e.absoluteX, e.absoluteY);
        })
        .onTouchesCancelled(() => {
          runOnJS(onDragEnd)(team, -1, -1);
        }),
    [team, notesFocused, onDragStart, onDragMove, onDragEnd, dragX, dragY]
  );

  return (
    <View
      className="relative"
      onLayout={(e) =>
        onLayoutCard(team.id, {
          y: e.nativeEvent.layout.y,
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      {indicatorBefore ? (
        <View className="absolute -top-[5px] left-0 right-0 z-10 h-0.5 bg-primary" />
      ) : null}
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
          </View>

          <View className="relative w-full">
            <Text
              accessible={false}
              pointerEvents="none"
              className="absolute left-0 right-0 px-2 py-1.5 text-xs leading-4 opacity-0"
              onLayout={(event) => {
                const nextHeight = event.nativeEvent.layout.height;
                const wasScrollable = measuredNotesHeight.current > NOTES_MAX_HEIGHT;
                measuredNotesHeight.current = nextHeight;
                if (nextHeight <= NOTES_MAX_HEIGHT || !wasScrollable) {
                  setNotesScrollReady(false);
                }
                setNotesContentHeight(nextHeight);
              }}
            >
              {`${draft}\u200b`}
            </Text>
            <Textarea
            ref={notesInputRef}
            value={draft}
            onChangeText={changeNotes}
            onChange={
              Platform.OS === 'web'
                ? (event) =>
                    resizeWebNotes(event.target as unknown as HTMLTextAreaElement)
                : undefined
            }
            onFocus={() => setNotesFocused(true)}
            onBlur={() => {
              setNotesFocused(false);
              flushNotes();
            }}
            numberOfLines={1}
            scrollEnabled={
              Platform.OS === 'web'
                ? undefined
                : notesContentHeight > NOTES_MAX_HEIGHT && notesScrollReady
            }
            placeholder="Picklist notes…"
            placeholderTextColor={colorScheme === 'dark' ? 'hsl(0 0% 48%)' : 'hsl(0 0% 78%)'}
            className="min-h-[28px] max-h-[60px] resize-none rounded-sm border-0 bg-muted px-2 py-1.5 text-xs leading-4 outline-none focus:border-transparent"
            style={
              Platform.OS !== 'web' && notesContentHeight > NOTES_MAX_HEIGHT
                ? {
                    height: Math.min(
                      Math.max(notesContentHeight, NOTES_MIN_HEIGHT),
                      NOTES_MAX_HEIGHT
                    ),
                  }
                : undefined
            }
            />
          </View>
        </View>
      </GestureDetector>
      {indicatorAfter ? (
        <View className="absolute -bottom-[5px] left-0 right-0 z-10 h-0.5 bg-primary" />
      ) : null}
    </View>
  );
}

export default function PicklistScreen() {
  const { data: teams, isLoading } = usePicklist();
  const { data: questions } = useCapabilityQuestions(true);
  const moveTeam = useMoveTeam();
  const { isWide } = useBreakpoint();
  const dragOverlay = useDragOverlay();

  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState<Filters>({});
  const [showFilters, setShowFilters] = React.useState(false);
  const [popupPos, setPopupPos] = React.useState<{ left: number; top: number } | null>(null);
  const [facemashOpen, setFacemashOpen] = React.useState(false);

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

  const columns = React.useMemo(
    () =>
      TIER_ORDER.map((key) => {
        const all = tierLists.get(key)!;
        return {
          key,
          all,
          shown: all
            .map((team, index) => ({ team, index }))
            .filter(({ team }) => searchVisible(team)),
        };
      }),
    [searchVisible, tierLists]
  );

  // ---- Filter popup anchoring --------------------------------------------------

  const rootRef = React.useRef<View>(null);
  const rootRect = React.useRef({ x: 0, y: 0 });
  const filterBtnRef = React.useRef<View>(null);
  const measureRoot = React.useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      rootRect.current = { x, y };
    });
  }, []);

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
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragOffsetX = useSharedValue(0);
  const dragOffsetY = useSharedValue(0);
  const dragWidth = useSharedValue(240);
  const ghostStyle = useAnimatedStyle(() => ({
    left: dragX.value - dragOffsetX.value,
    top: dragY.value - dragOffsetY.value,
    width: dragWidth.value,
  }));
  const pointerDrag = React.useRef<WebPointerDrag | null>(null);
  const suppressNextClick = React.useRef(false);
  const queuedNativeMove = React.useRef<{
    team: PicklistTeam;
    absX: number;
    absY: number;
  } | null>(null);
  const nativeMoveFrame = React.useRef<number | null>(null);

  const boardRef = React.useRef<View>(null);
  const boardRect = React.useRef({ x: 0, y: 0, w: 0, h: 0 });
  const hScroll = React.useRef(0);
  const vScroll = React.useRef<Record<string, number>>({});
  const cardLayouts = React.useRef(new Map<string, CardLayout>());
  const columnLayouts = React.useRef(new Map<TierKey, ColumnLayout>());

  const measureBoard = React.useCallback(() => {
    boardRef.current?.measureInWindow((x, y, w, h) => {
      boardRect.current = { x, y, w, h };
    });
  }, []);

  const onLayoutCard = React.useCallback((teamId: string, layout: CardLayout) => {
    cardLayouts.current.set(teamId, layout);
  }, []);

  const resolveDropPoint = React.useCallback(
    (team: PicklistTeam, absX: number, absY: number): DropTarget | null => {
      const board = boardRect.current;
      if (board.w === 0 || absY < board.y || absY > board.y + board.h) return null;

      const contentX = absX - board.x + (isWide ? 0 : hScroll.current);
      const column = columns.find(({ key }) => {
        const layout = columnLayouts.current.get(key);
        return layout && contentX >= layout.x && contentX <= layout.x + layout.w;
      });
      if (!column) return null;
      const columnLayout = columnLayouts.current.get(column.key);
      if (
        !columnLayout ||
        absY < board.y + columnLayout.y ||
        absY > board.y + columnLayout.y + columnLayout.h
      ) {
        return null;
      }
      if (column.key === 'untiered') {
        if (team.tier === null) return null;
        return {
          tierKey: column.key,
          markerIndex: 0,
          insertBeforeTeamId: null,
          dimContents: true,
        };
      }
      const shownTeams = column.shown.map(({ team: shownTeam }) => shownTeam);
      const contentY =
        absY -
        board.y -
        columnLayout.y -
        COL_HEADER_HEIGHT +
        (vScroll.current[column.key] ?? 0);
      let markerIndex = shownTeams.length;
      for (let index = 0; index < shownTeams.length; index += 1) {
        const layout = cardLayouts.current.get(shownTeams[index].id);
        if (layout && contentY < layout.y + layout.h / 2) {
          markerIndex = index;
          break;
        }
      }

      const insertBeforeTeam =
        shownTeams.slice(markerIndex).find((shownTeam) => shownTeam.id !== team.id) ?? null;
      return {
        tierKey: column.key,
        markerIndex,
        insertBeforeTeamId: insertBeforeTeam?.id ?? null,
      };
    },
    [columns, isWide]
  );

  const commitDrop = React.useCallback(
    (team: PicklistTeam, target: DropTarget | null) => {
      if (!target) return;
      const targetTier: PicklistTier | null =
        target.tierKey === 'untiered' ? null : target.tierKey;
      if (target.tierKey === 'untiered') {
        moveTeam.mutate({ teamId: team.id, tier: null, orderedIds: [] });
        return;
      }
      const fullList = tierLists.get(target.tierKey)!.filter((candidate) => candidate.id !== team.id);
      const orderedIds = fullList.map((candidate) => candidate.id);
      const insertAt = target.insertBeforeTeamId
        ? orderedIds.indexOf(target.insertBeforeTeamId)
        : orderedIds.length;
      orderedIds.splice(insertAt < 0 ? orderedIds.length : insertAt, 0, team.id);

      const currentIds = tierLists.get(target.tierKey)!.map((candidate) => candidate.id);
      const sameTier = (team.tier ?? 'untiered') === target.tierKey;
      if (
        sameTier &&
        orderedIds.length === currentIds.length &&
        orderedIds.every((id, index) => id === currentIds[index])
      ) {
        return;
      }
      moveTeam.mutate({ teamId: team.id, tier: targetTier, orderedIds });
    },
    [moveTeam, tierLists]
  );

  const updateDropTarget = React.useCallback((next: DropTarget | null) => {
    setDropTarget((current) => {
      if (
        current?.tierKey === next?.tierKey &&
        current?.markerIndex === next?.markerIndex &&
        current?.insertBeforeTeamId === next?.insertBeforeTeamId &&
        current?.dimContents === next?.dimContents
      ) {
        return current;
      }
      return next;
    });
  }, []);

  // Reanimated shared values are mutable containers written from gesture
  // callbacks; the compiler's immutability/deps rules don't model that, so
  // the writes and depless callbacks below carry targeted disables.
  const onDragStart = React.useCallback(
    (
      team: PicklistTeam,
      absX: number,
      absY: number,
      localX: number,
      localY: number
    ) => {
      measureBoard();
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      dragX.value = absX;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      dragY.value = absY;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      dragOffsetX.value = localX;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      dragOffsetY.value = localY;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      dragWidth.value = cardLayouts.current.get(team.id)?.w ?? 240;
      setDragTeam(team);
      setDraggingId(team.id);
      updateDropTarget(resolveDropPoint(team, absX, absY));
      const tierKey = team.tier ?? 'untiered';
      const index = tierLists
        .get(tierKey)!
        .findIndex((candidate) => candidate.id === team.id);
      const highlight =
        filterCount > 0 ? matchesFilters(team, filters) : null;
      dragOverlay.show(
        <Animated.View
          pointerEvents="none"
          className="shadow-lg"
          style={[
            ghostStyle,
            { position: 'absolute', opacity: 0.65, elevation: 20 },
          ]}
        >
          <PicklistTeamGhost
            team={team}
            index={Math.max(0, index)}
            highlight={highlight}
          />
        </Animated.View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measureBoard, resolveDropPoint, updateDropTarget, tierLists, filterCount, filters, dragOverlay]
  );

  const onDragMove = React.useCallback(
    (team: PicklistTeam, absX: number, absY: number) => {
      queuedNativeMove.current = { team, absX, absY };
      if (nativeMoveFrame.current !== null) return;
      nativeMoveFrame.current = requestAnimationFrame(() => {
        nativeMoveFrame.current = null;
        const move = queuedNativeMove.current;
        queuedNativeMove.current = null;
        if (!move) return;
        updateDropTarget(
          resolveDropPoint(move.team, move.absX, move.absY)
        );
      });
    },
    [resolveDropPoint, updateDropTarget]
  );

  const onDragEnd = React.useCallback(
    (team: PicklistTeam, absX: number, absY: number) => {
      if (nativeMoveFrame.current !== null) {
        cancelAnimationFrame(nativeMoveFrame.current);
        nativeMoveFrame.current = null;
      }
      queuedNativeMove.current = null;
      dragOverlay.hide();
      setDragTeam(null);
      setDraggingId(null);
      const target = absX < 0 ? null : resolveDropPoint(team, absX, absY);
      updateDropTarget(null);
      commitDrop(team, target);
    },
    [commitDrop, dragOverlay, resolveDropPoint, updateDropTarget]
  );

  React.useEffect(() => {
    if (!draggingId || typeof document === 'undefined') return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    document.getSelection()?.removeAllRanges();
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [draggingId]);

  const clearPointerDrag = React.useCallback(() => {
    const drag = pointerDrag.current;
    drag?.ghost?.remove();
    drag?.line?.remove();
    drag?.dimmedList?.style.removeProperty('opacity');
    if (drag?.moveListener) window.removeEventListener('pointermove', drag.moveListener);
    if (drag?.endListener) window.removeEventListener('pointerup', drag.endListener);
    if (drag?.cancelListener) window.removeEventListener('pointercancel', drag.cancelListener);
    pointerDrag.current = null;
    setDraggingId(null);
  }, []);

  const movePointerDrag = React.useCallback(
    (event: {
      pointerId: number;
      clientX: number;
      clientY: number;
      preventDefault: () => void;
    }) => {
      const drag = pointerDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (!drag.ghost && distance < 5) return;

      if (!drag.ghost) {
        const bounds = drag.sourceElement.getBoundingClientRect();
        const ghost = drag.sourceElement.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('data-picklist-team');
        Object.assign(ghost.style, {
          position: 'fixed',
          left: `${event.clientX - drag.offsetX}px`,
          top: `${event.clientY - drag.offsetY}px`,
          width: `${bounds.width}px`,
          opacity: '0.65',
          pointerEvents: 'none',
          zIndex: '9999',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
        });
        document.body.appendChild(ghost);
        drag.ghost = ghost;
        drag.sourceElement.setPointerCapture(event.pointerId);
        setDraggingId(drag.team.id);
      }

      event.preventDefault();
      drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
      drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;
      drag.dimmedList?.style.removeProperty('opacity');
      drag.dimmedList = null;

      const board = drag.sourceElement.closest<HTMLElement>('[data-picklist-board="true"]');
      const tierColumns = Array.from(
        board?.querySelectorAll<HTMLElement>('[data-picklist-tier]') ?? []
      );
      const targetColumn = tierColumns.find((column) => {
        const bounds = column.getBoundingClientRect();
        return (
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom
        );
      });

      if (!targetColumn) {
        drag.target = null;
        drag.line?.remove();
        return;
      }

      const tierKey = targetColumn.dataset.picklistTier as TierKey;
      const targetList =
        targetColumn.querySelector<HTMLElement>('[data-picklist-list="true"]') ??
        targetColumn;
      if (tierKey === 'untiered') {
        drag.line?.remove();
        if (drag.team.tier === null) {
          drag.target = null;
          return;
        }
        targetList.style.opacity = '0.6';
        drag.dimmedList = targetList;
        drag.target = {
          tierKey,
          markerIndex: 0,
          insertBeforeTeamId: null,
          dimContents: true,
        };
        return;
      }

      const rows = Array.from(
        targetColumn.querySelectorAll<HTMLElement>('[data-picklist-team]')
      );
      let markerIndex = rows.length;
      for (let index = 0; index < rows.length; index += 1) {
        const bounds = rows[index].getBoundingClientRect();
        if (event.clientY < bounds.top + bounds.height / 2) {
          markerIndex = index;
          break;
        }
      }

      const insertBeforeRow =
        rows.slice(markerIndex).find((row) => row.dataset.picklistTeam !== drag.team.id) ?? null;
      drag.target = {
        tierKey,
        markerIndex,
        insertBeforeTeamId: insertBeforeRow?.dataset.picklistTeam ?? null,
      };

      const line = drag.line ?? document.createElement('div');
      // eslint-disable-next-line react-hooks/immutability -- drag visuals are mutable DOM refs
      line.className = 'pointer-events-none fixed z-[9998] h-0.5 bg-primary';
      drag.line = line;

      if (rows.length > 0) {
        const firstBounds = rows[0].getBoundingClientRect();
        const lastBounds = rows[rows.length - 1].getBoundingClientRect();
        const lineY =
          markerIndex === 0
            ? firstBounds.top
            : markerIndex === rows.length
              ? lastBounds.bottom
              : (rows[markerIndex - 1].getBoundingClientRect().bottom +
                  rows[markerIndex].getBoundingClientRect().top) /
                2;
        Object.assign(line.style, {
          left: `${firstBounds.left}px`,
          top: `${lineY - 1}px`,
          width: `${firstBounds.width}px`,
        });
      } else {
        const bounds = targetList.getBoundingClientRect();
        Object.assign(line.style, {
          left: `${bounds.left + 8}px`,
          top: `${bounds.top + 8}px`,
          width: `${Math.max(0, bounds.width - 16)}px`,
        });
      }
      if (!line.isConnected) document.body.appendChild(line);
    },
    []
  );

  const endPointerDrag = React.useCallback(
    (event: { pointerId: number; preventDefault: () => void }) => {
      const drag = pointerDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.sourceElement.hasPointerCapture(event.pointerId)) {
        drag.sourceElement.releasePointerCapture(event.pointerId);
      }
      if (drag.ghost) {
        event.preventDefault();
        suppressNextClick.current = true;
        setTimeout(() => {
          suppressNextClick.current = false;
        }, 0);
        commitDrop(drag.team, drag.target);
      }
      clearPointerDrag();
    },
    [clearPointerDrag, commitDrop]
  );

  const startPointerDrag = React.useCallback(
    (event: React.PointerEvent<HTMLElement>, team: PicklistTeam) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea')) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const drag: WebPointerDrag = {
        team,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - bounds.left,
        offsetY: event.clientY - bounds.top,
        sourceElement: event.currentTarget,
        ghost: null,
        line: null,
        dimmedList: null,
        target: null,
        moveListener: null,
        endListener: null,
        cancelListener: null,
      };
      drag.moveListener = (pointerEvent) => movePointerDrag(pointerEvent);
      drag.endListener = (pointerEvent) => endPointerDrag(pointerEvent);
      drag.cancelListener = (pointerEvent) => {
        if (pointerDrag.current?.pointerId === pointerEvent.pointerId) clearPointerDrag();
      };
      pointerDrag.current = drag;
      window.addEventListener('pointermove', drag.moveListener, { passive: false });
      window.addEventListener('pointerup', drag.endListener);
      window.addEventListener('pointercancel', drag.cancelListener);
    },
    [clearPointerDrag, endPointerDrag, movePointerDrag]
  );

  // ---- Render -------------------------------------------------------------------

  const renderColumn = (col: (typeof columns)[number]) => (
    <View
      key={col.key}
      onLayout={(event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        columnLayouts.current.set(col.key, { x, y, w: width, h: height });
      }}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { picklistTier: col.key } } as any)
        : {})}
      className={cn('h-full rounded-md border border-border bg-card', isWide ? 'flex-1' : 'w-72')}
    >
      <View className="flex-row items-center gap-2 border-b border-border px-3 py-2.5">
        <View className={cn('h-2 w-2 rounded-none', TIER_DOT[col.key])} />
        <Text variant="label">{tierLabel(col.key)}</Text>
        <Badge variant="muted" label={String(col.shown.length)} />
      </View>
      <ScrollView
        {...(Platform.OS === 'web'
          ? ({ dataSet: { picklistList: 'true' } } as any)
          : {})}
        className="flex-1"
        contentContainerClassName={cn(
          'gap-2 p-2',
          Platform.OS !== 'web' &&
            dropTarget?.tierKey === col.key &&
            dropTarget.dimContents &&
            'opacity-60'
        )}
        scrollEnabled={!dragTeam && !draggingId}
        onScroll={(e) => {
          vScroll.current[col.key] = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
      >
        {col.shown.length === 0 ? (
          <View className="relative items-center py-8">
            {dropTarget?.tierKey === col.key && !dropTarget.dimContents ? (
              <View className="absolute left-0 right-0 top-0 h-0.5 bg-primary" />
            ) : null}
            <Text variant="small">No teams</Text>
          </View>
        ) : (
          col.shown.map(({ team, index }, shownIndex) => {
            const card = (
              <TeamCard
                team={team}
                index={index}
                highlight={filterCount > 0 ? matchesFilters(team, filters) : null}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onLayoutCard={onLayoutCard}
                dragX={dragX}
                dragY={dragY}
                dragging={draggingId === team.id}
                indicatorBefore={
                  Platform.OS !== 'web' &&
                  dropTarget?.tierKey === col.key &&
                  !dropTarget.dimContents &&
                  dropTarget.markerIndex === shownIndex
                }
                indicatorAfter={
                  Platform.OS !== 'web' &&
                  dropTarget?.tierKey === col.key &&
                  !dropTarget.dimContents &&
                  dropTarget.markerIndex === col.shown.length &&
                  shownIndex === col.shown.length - 1
                }
              />
            );

            return Platform.OS === 'web'
              ? React.createElement(
                  'div',
                  {
                    key: team.id,
                    'data-picklist-team': team.id,
                    onPointerDown: (event: React.PointerEvent<HTMLElement>) =>
                      startPointerDrag(event, team),
                    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
                      if (!suppressNextClick.current) return;
                      suppressNextClick.current = false;
                      event.preventDefault();
                      event.stopPropagation();
                    },
                    className: cn(
                      'relative',
                      draggingId === team.id && 'cursor-grabbing opacity-30'
                    ),
                  },
                  card
                )
              : React.cloneElement(card, { key: team.id });
          })
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
          <Button
            variant="outline"
            size="sm"
            icon={Swords}
            label="Facemash"
            accessibilityLabel="Compare two teams"
            disabled={(teams ?? []).length < 2}
            onPress={() => setFacemashOpen(true)}
          />
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
        <View
          ref={boardRef}
          onLayout={measureBoard}
          {...(Platform.OS === 'web'
            ? ({ dataSet: { picklistBoard: 'true' } } as any)
            : {})}
          className="flex-1 flex-row gap-3 px-6 pb-4"
        >
          {columns.map(renderColumn)}
        </View>
      ) : (
        <View
          ref={boardRef}
          onLayout={measureBoard}
          {...(Platform.OS === 'web'
            ? ({ dataSet: { picklistBoard: 'true' } } as any)
            : {})}
          className="flex-1"
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-1"
            contentContainerClassName="gap-3 px-4 pb-4"
            scrollEnabled={!dragTeam && !draggingId}
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

      <FacemashModal
        visible={facemashOpen}
        onClose={() => setFacemashOpen(false)}
        teams={teams ?? []}
        questions={questions ?? []}
      />

    </View>
  );
}
