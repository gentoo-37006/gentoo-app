import * as React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Search, Swords, X } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useEventTeamStats, useTeamMatchReports, type EventTeamStats } from '@/lib/queries/facemash';
import { useMatches, type MatchWithAssignments } from '@/lib/queries/matches';
import { tierSort, useMoveTeam, type PicklistTeam } from '@/lib/queries/picklist';
import { useTeamDetail } from '@/lib/queries/scouting';
import { tierLabel, type CapabilityQuestion, type PicklistTier, type TierKey } from '@/lib/types';

const tierKey = (t: PicklistTeam): TierKey => t.tier ?? 'untiered';

type MoveVars = { teamId: string; tier: PicklistTier | null; orderedIds: string[] };

const METRICS: { label: string; pick: (s: EventTeamStats) => number | null }[] = [
  { label: 'OPR', pick: (s) => s.opr?.totalPoints ?? null },
  { label: 'Avg score', pick: (s) => s.avg?.totalPoints ?? null },
  { label: 'Avg auto', pick: (s) => s.avg?.autoPoints ?? null },
  { label: 'Avg teleop', pick: (s) => s.avg?.dcPoints ?? null },
  { label: 'RP', pick: (s) => s.rp },
  { label: 'Best score', pick: (s) => s.max?.totalPoints ?? null },
];

type Outcome = {
  tone: 'success' | 'warning' | 'muted';
  title: string;
  detail: string;
  /** Set only when the tier needs renumbering. */
  orderedIds?: string[];
  /** The tier's order before the swap, replayed when the pick is undone. */
  revertIds?: string[];
};

/**
 * Ranks only move when the two teams sit directly beside each other in the same
 * tier — anything else is reported back for the user to reorder by hand.
 */
function compareOutcome(winner: PicklistTeam, loser: PicklistTeam, teams: PicklistTeam[]): Outcome {
  const key = tierKey(winner);
  if (key !== tierKey(loser)) {
    return {
      tone: 'warning',
      title: 'Ranks unchanged',
      detail: `#${winner.team_number} is in ${tierLabel(key)} and #${loser.team_number} is in ${tierLabel(tierKey(loser))}. Move them by hand to change the picklist.`,
    };
  }

  const group = teams.filter((t) => tierKey(t) === key).sort(tierSort);
  const wi = group.findIndex((t) => t.id === winner.id);
  const li = group.findIndex((t) => t.id === loser.id);
  if (Math.abs(wi - li) !== 1) {
    return {
      tone: 'warning',
      title: 'Ranks unchanged',
      detail: `They sit at #${wi + 1} and #${li + 1} in ${tierLabel(key)}. Only teams directly beside each other swap automatically — move them by hand.`,
    };
  }
  if (wi < li) {
    return {
      tone: 'muted',
      title: 'Already ranked higher',
      detail: `#${winner.team_number} was already above #${loser.team_number} in ${tierLabel(key)}.`,
    };
  }

  const revertIds = group.map((t) => t.id);
  const orderedIds = [...revertIds];
  [orderedIds[wi], orderedIds[li]] = [orderedIds[li], orderedIds[wi]];
  return {
    tone: 'success',
    title: 'Picklist updated',
    detail: `#${winner.team_number} moved to #${li + 1} in ${tierLabel(key)}, above #${loser.team_number}.`,
    orderedIds,
    revertIds,
  };
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1);

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="label" className="pt-3 text-muted-foreground">
      {children}
    </Text>
  );
}

/** Stat tile: label over value, value greened when this team wins the metric. */
function Stat({ label, value, best }: { label: string; value: string; best: boolean }) {
  return (
    <View className="flex-1 gap-0.5 rounded-sm border border-border bg-background px-2 py-1.5">
      <Text
        className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text className={cn('text-base font-extrabold', best && 'text-success')}>{value}</Text>
    </View>
  );
}

function Chip({ label, percent }: { label: string; percent: number }) {
  const tone =
    percent >= 67
      ? 'border-success bg-success/15'
      : percent <= 33
        ? 'border-destructive bg-destructive/15'
        : 'border-border bg-muted';
  return (
    <View className={cn('flex-row items-center gap-1 rounded-sm border px-1.5 py-0.5', tone)}>
      <Text className="text-[11px] font-semibold">{label}</Text>
      <Text className="text-[11px] font-bold text-muted-foreground">{percent}%</Text>
    </View>
  );
}

/** "Q 7" / "Elim 4" — elims carry the scoring system's series-encoded number. */
function matchLabel(m: MatchWithAssignments): string {
  if (m.label) return m.label;
  if (m.tournament_level && m.tournament_level !== 'Quals') {
    return `Elim ${m.match_number > 20000 ? Math.floor(m.match_number / 1000) - 20 : m.match_number}`;
  }
  return `Q ${m.match_number}`;
}

function MatchRow({
  match,
  teamNumber,
  onOpen,
}: {
  match: MatchWithAssignments;
  teamNumber: number;
  onOpen: () => void;
}) {
  const red = match.red1 === teamNumber || match.red2 === teamNumber;
  const score = red ? match.red_score : match.blue_score;
  const other = red ? match.blue_score : match.red_score;
  const won = match.has_been_played && (score ?? 0) > (other ?? 0);
  return (
    <Pressable
      onPress={onOpen}
      className="flex-row items-center gap-2 rounded-sm border border-border bg-background px-2 py-1.5 active:bg-accent"
    >
      <View className={cn('h-2 w-2', red ? 'bg-destructive' : 'bg-primary')} />
      <Text className="flex-1 text-xs font-bold" numberOfLines={1}>
        {matchLabel(match)}
      </Text>
      {match.has_been_played ? (
        <Text className={cn('text-xs font-bold', won ? 'text-success' : 'text-muted-foreground')}>
          {score ?? 0}–{other ?? 0}
        </Text>
      ) : (
        <Text variant="small">Upcoming</Text>
      )}
      <Icon as={ChevronRight} size={13} className="text-muted-foreground" />
    </Pressable>
  );
}

type Note = { label: string; text: string };

type RailProps = {
  team: PicklistTeam;
  position: string;
  stats?: EventTeamStats;
  /** Metric labels this team wins outright. */
  wins: Set<string>;
  questions: CapabilityQuestion[];
  notes: Note[];
  matches: MatchWithAssignments[];
  loading: boolean;
  onOpenMatch: (id: string) => void;
};

/** One side's dossier: stats, rank, capabilities, notes, matches. */
function TeamRail({ team, position, stats, wins, questions, notes, matches, loading, onOpenMatch }: RailProps) {
  const caps = questions.filter((q) => team.capabilities[q.id] != null);
  const rows = METRICS.filter((_, i) => i % 2 === 0).map((m, i) => [m, METRICS[i * 2 + 1]]);
  return (
    <View className="gap-1.5 pb-4">
      <View className="gap-1 pt-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-extrabold leading-tight">#{team.team_number}</Text>
          {/* Badge defaults to self-start, which floats it above the number. */}
          <Badge variant="muted" label={position} className="self-center" />
        </View>
        <Text variant="small" numberOfLines={1}>
          {team.team_name ?? 'Unknown name'}
        </Text>
      </View>

      <SectionLabel>Performance</SectionLabel>
      {loading ? (
        <ActivityIndicator className="py-4" />
      ) : (
        <>
          {rows.map((pair, i) => (
            <View key={i} className="flex-row gap-1.5">
              {pair.map((m) =>
                m ? (
                  <Stat
                    key={m.label}
                    label={m.label}
                    value={fmt(stats ? m.pick(stats) : null)}
                    best={wins.has(m.label)}
                  />
                ) : null
              )}
            </View>
          ))}
          <View className="flex-row items-center justify-between rounded-sm border border-border bg-background px-2 py-1.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Rank · record
            </Text>
            <Text className={cn('text-sm font-extrabold', wins.has('Rank') && 'text-success')}>
              {stats ? `#${stats.rank ?? '—'} · ${stats.wins}-${stats.losses}-${stats.ties}` : '—'}
            </Text>
          </View>
        </>
      )}

      <SectionLabel>Capabilities</SectionLabel>
      {caps.length === 0 ? (
        <Text variant="small">No pit data</Text>
      ) : (
        <View className="flex-row flex-wrap gap-1">
          {caps.map((q) => (
            <Chip key={q.id} label={q.prompt} percent={team.capabilities[q.id]} />
          ))}
        </View>
      )}

      <SectionLabel>{`Notes (${notes.length})`}</SectionLabel>
      {notes.length === 0 ? (
        <Text variant="small">No notes yet</Text>
      ) : (
        notes.map((n, i) => (
          <View key={i} className="gap-0.5 rounded-sm bg-muted px-2 py-1.5">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {n.label}
            </Text>
            <Text className="text-xs">{n.text}</Text>
          </View>
        ))
      )}

      <SectionLabel>{`Matches (${matches.length})`}</SectionLabel>
      {matches.length === 0 ? (
        <Text variant="small">No matches</Text>
      ) : (
        matches.map((m) => (
          <MatchRow key={m.id} match={m} teamNumber={team.team_number} onOpen={() => onOpenMatch(m.id)} />
        ))
      )}
    </View>
  );
}

/** The big centre card you press to crown a winner. */
function PickPanel({
  team,
  chosen,
  pending,
  onPick,
}: {
  team: PicklistTeam;
  chosen: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <Pressable
      onPress={onPick}
      disabled={pending}
      accessibilityLabel={`Pick team ${team.team_number}`}
      className={cn(
        'min-h-[260px] flex-1 justify-end rounded-md border-2 p-5',
        chosen ? 'border-primary bg-primary/10' : 'border-border bg-background active:border-primary'
      )}
    >
      {chosen ? (
        <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center">
          <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background">
            {pending ? <ActivityIndicator /> : <Icon as={Check} size={26} className="text-primary" />}
          </View>
        </View>
      ) : null}
      <Text className="text-center text-4xl font-extrabold" numberOfLines={1} adjustsFontSizeToFit>
        #{team.team_number}
      </Text>
      <Text variant="small" className="text-center" numberOfLines={1}>
        {team.team_name ?? 'Unknown name'}
      </Text>
    </Pressable>
  );
}

function SelectRow({
  team,
  position,
  selected,
  disabled,
  onToggle,
}: {
  team: PicklistTeam;
  position: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      className={cn(
        'flex-row items-center gap-2.5 rounded-sm border px-2.5 py-2',
        selected ? 'border-primary bg-primary/10' : 'border-border active:bg-accent',
        disabled && 'opacity-40'
      )}
    >
      <View
        className={cn(
          'h-4 w-4 items-center justify-center rounded-sm border',
          selected ? 'border-primary bg-primary' : 'border-border'
        )}
      >
        {selected ? <Icon as={Check} size={11} className="text-primary-foreground" /> : null}
      </View>
      <Text className="text-sm font-bold">#{team.team_number}</Text>
      <Text variant="small" className="flex-1" numberOfLines={1}>
        {team.team_name ?? 'Unknown name'}
      </Text>
      <Text variant="small">{position}</Text>
    </Pressable>
  );
}

export function FacemashModal({
  visible,
  onClose,
  teams,
  questions,
}: {
  visible: boolean;
  onClose: () => void;
  teams: PicklistTeam[];
  questions: CapabilityQuestion[];
}) {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [comparing, setComparing] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [choice, setChoice] = React.useState<string | null>(null);
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  /** Tier order as it stood when this pair opened — picks are decided against it. */
  const [snapshot, setSnapshot] = React.useState<PicklistTeam[]>([]);
  /** Replays the pre-pick order when the same robot is tapped again. */
  const [undo, setUndo] = React.useState<MoveVars | null>(null);
  const moveTeam = useMoveTeam();

  const a = teams.find((t) => t.id === picked[0]);
  const b = teams.find((t) => t.id === picked[1]);

  const { data: stats, isLoading: statsLoading } = useEventTeamStats(visible);
  const { data: matches } = useMatches();
  const detailA = useTeamDetail(comparing ? (picked[0] ?? '') : '');
  const detailB = useTeamDetail(comparing ? (picked[1] ?? '') : '');
  const reportsA = useTeamMatchReports(comparing ? a?.team_number : undefined);
  const reportsB = useTeamMatchReports(comparing ? b?.team_number : undefined);

  const statsA = a ? stats?.[a.team_number] : undefined;
  const statsB = b ? stats?.[b.team_number] : undefined;

  /** Metric labels each side wins, so the rails can flag their own best numbers. */
  const [winsA, winsB] = React.useMemo(() => {
    const left = new Set<string>();
    const right = new Set<string>();
    const add = (label: string, l: number | null, r: number | null, lowerBetter = false) => {
      if (l == null || r == null || l === r) return;
      ((l > r) === !lowerBetter ? left : right).add(label);
    };
    for (const m of METRICS) add(m.label, statsA ? m.pick(statsA) : null, statsB ? m.pick(statsB) : null);
    add('Rank', statsA?.rank ?? null, statsB?.rank ?? null, true);
    return [left, right];
  }, [statsA, statsB]);

  /** "Tier 1 · #3" for every team, from the same ordering the board uses. */
  const positions = React.useMemo(() => {
    const map = new Map<string, string>();
    const groups = new Map<TierKey, PicklistTeam[]>();
    for (const t of teams) {
      const key = tierKey(t);
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    for (const [key, group] of groups) {
      group.sort(tierSort).forEach((t, i) => map.set(t.id, `${tierLabel(key)} · #${i + 1}`));
    }
    return map;
  }, [teams]);

  const reset = () => {
    setPicked([]);
    setComparing(false);
    setChoice(null);
    setOutcome(null);
    setSearch('');
    setUndo(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const openMatch = (id: string) => {
    close();
    router.push(`/scouting/matches/${id}` as any);
  };

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  /** Tapping a robot crowns it; tapping the crowned one again undoes the pick. */
  const decide = async (winner: PicklistTeam, loser: PicklistTeam) => {
    setUndo(null);
    if (undo) await moveTeam.mutateAsync(undo);
    if (choice === winner.id) {
      setChoice(null);
      setOutcome(null);
      return;
    }

    setChoice(winner.id);
    const result = compareOutcome(winner, loser, snapshot);
    if (result.orderedIds && result.revertIds) {
      await moveTeam.mutateAsync({ teamId: winner.id, tier: winner.tier, orderedIds: result.orderedIds });
      setUndo({ teamId: winner.id, tier: winner.tier, orderedIds: result.revertIds });
    }
    setOutcome(result);
  };

  const shown = teams.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(t.team_number).includes(q) || (t.team_name ?? '').toLowerCase().includes(q);
  });

  const notesOf = (
    team: PicklistTeam,
    detail: ReturnType<typeof useTeamDetail>['data'],
    reports: ReturnType<typeof useTeamMatchReports>['data']
  ): Note[] => [
    ...(team.notes ? [{ label: 'Picklist', text: team.notes }] : []),
    ...(detail?.entries ?? [])
      .filter((e) => e.notes)
      .map((e) => ({ label: e.scouter?.full_name ?? 'Pit report', text: e.notes! })),
    ...(reports ?? [])
      .filter((r) => r.notes)
      .map((r) => ({ label: r.played_defense ? 'Match · defense' : 'Match', text: r.notes! })),
  ];

  const railFor = (team: PicklistTeam, side: 'a' | 'b'): RailProps => ({
    team,
    position: positions.get(team.id) ?? '',
    stats: side === 'a' ? statsA : statsB,
    wins: side === 'a' ? winsA : winsB,
    questions,
    notes:
      side === 'a'
        ? notesOf(team, detailA.data, reportsA.data)
        : notesOf(team, detailB.data, reportsB.data),
    matches: (matches ?? []).filter((m) =>
      [m.red1, m.red2, m.blue1, m.blue2].includes(team.team_number)
    ),
    loading: statsLoading,
    onOpenMatch: openMatch,
  });

  const arena =
    a && b ? (
      <View className="gap-4 p-4">
        <View className="flex-row items-stretch gap-3">
          <PickPanel team={a} chosen={choice === a.id} pending={moveTeam.isPending} onPick={() => decide(a, b)} />
          <View className="h-10 w-10 self-center items-center justify-center rounded-full border border-border bg-background">
            <Text className="text-[11px] font-extrabold uppercase text-muted-foreground">vs</Text>
          </View>
          <PickPanel team={b} chosen={choice === b.id} pending={moveTeam.isPending} onPick={() => decide(b, a)} />
        </View>

        {/* Fixed-height slot: the verdict drops in without shifting the panels. */}
        <View className="h-44">
          {outcome ? (
            <View className="items-center gap-3 rounded-md border border-border bg-background p-4">
              <Badge
                variant={outcome.tone === 'success' ? 'success' : outcome.tone === 'warning' ? 'warning' : 'muted'}
                label={outcome.title}
              />
              <Text className="text-center text-sm">{outcome.detail}</Text>
              <View className="flex-row gap-2">
                <Button variant="outline" size="sm" label="Compare another" onPress={reset} />
                <Button size="sm" label="Done" onPress={close} />
              </View>
            </View>
          ) : (
            <Text variant="small" className="pt-2 text-center">
              Tap a robot to rank it above the other.
            </Text>
          )}
        </View>
      </View>
    ) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-black/60 p-2 md:p-5">
        <View className="w-full max-w-[1400px] flex-1 rounded-md border border-border bg-card">
          <View className="flex-row items-center gap-2 border-b border-border px-4 py-3">
            <Icon as={Swords} size={18} className="text-primary" />
            {/* One Text so the subtitle shares the title's baseline. */}
            <Text className="text-base font-extrabold uppercase tracking-widest">
              Facemash
              {isWide ? (
                <Text className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                  {'   | Pick the better robot'}
                </Text>
              ) : null}
            </Text>
            <View className="flex-1" />
            <Pressable
              onPress={close}
              accessibilityLabel="Close facemash"
              className="h-8 w-8 items-center justify-center rounded-sm active:bg-accent"
            >
              <Icon as={X} size={18} className="text-muted-foreground" />
            </Pressable>
          </View>

          {!comparing || !a || !b ? (
            <View className="flex-1 items-center p-4">
              <View className="w-full max-w-lg flex-1 gap-3">
                <View className="h-10 flex-row items-center gap-2 rounded-md border border-input bg-background px-3">
                  <Icon as={Search} size={16} className="text-muted-foreground" />
                  <Input
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search teams…"
                    className="h-full flex-1 border-0 px-0 text-sm"
                  />
                </View>
                <ScrollView className="flex-1" contentContainerClassName="gap-1.5">
                  {shown.map((t) => (
                    <SelectRow
                      key={t.id}
                      team={t}
                      position={positions.get(t.id) ?? ''}
                      selected={picked.includes(t.id)}
                      disabled={picked.length >= 2 && !picked.includes(t.id)}
                      onToggle={() => toggle(t.id)}
                    />
                  ))}
                </ScrollView>
                <Button
                  label={`Start facemash (${picked.length}/2)`}
                  disabled={picked.length !== 2}
                  onPress={() => {
                    setSnapshot(teams);
                    setComparing(true);
                  }}
                />
              </View>
            </View>
          ) : isWide ? (
            <View className="flex-1 flex-row">
              {/* Width lives on the wrapper — a ScrollView sizes itself from its
                  content and would otherwise squeeze the arena. */}
              <View className="w-72 shrink-0 border-r border-border">
                <ScrollView className="flex-1 px-3" showsVerticalScrollIndicator={false}>
                  <TeamRail {...railFor(a, 'a')} />
                </ScrollView>
              </View>
              <View className="min-w-0 flex-1 justify-center">{arena}</View>
              <View className="w-72 shrink-0 border-l border-border">
                <ScrollView className="flex-1 px-3" showsVerticalScrollIndicator={false}>
                  <TeamRail {...railFor(b, 'b')} />
                </ScrollView>
              </View>
            </View>
          ) : (
            <ScrollView className="flex-1" contentContainerClassName="gap-4 px-3 pb-6">
              {arena}
              <TeamRail {...railFor(a, 'a')} />
              <TeamRail {...railFor(b, 'b')} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
