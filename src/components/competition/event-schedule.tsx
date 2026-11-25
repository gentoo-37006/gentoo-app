import * as React from 'react';
import { Pressable, View } from 'react-native';
import {
  CalendarClock,
  ClipboardCheck,
  Gavel,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ModalSheet } from '@/components/ui/modal-sheet';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import {
  AGENDA_KINDS,
  buildSchedule,
  localDateTime,
  matchSides,
  ourMatches,
  parseClockTime,
  splitLocalDateTime,
  type AgendaItem,
  type AgendaKind,
  type ScheduleState,
} from '@/lib/competition';
import { formatDayLabel, formatTime, timeUntil } from '@/lib/format';
import type { MatchWithAssignments } from '@/lib/queries/matches';
import { useSaveEventAgenda } from '@/lib/queries/event-agenda';
import { OUR_TEAM_NUMBER } from '@/lib/team';
import { matchTitle } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';

const kindLabel = (kind: AgendaKind) => AGENDA_KINDS.find((k) => k.value === kind)?.label ?? 'Other';

function timeRange(start: string, end: string | null) {
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

const STATE_BADGE: Partial<Record<ScheduleState, { label: string; variant: 'success' | 'default' }>> = {
  now: { label: 'Now', variant: 'success' },
  next: { label: 'Next', variant: 'default' },
};

/** The team's event-day plan merged with our matches, day by day. */
export function EventScheduleCard({
  eventCode,
  agenda,
  matches,
  canEdit,
  onEdit,
}: {
  eventCode: string;
  agenda: AgendaItem[];
  matches: MatchWithAssignments[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const now = useNow(30_000);
  const days = buildSchedule(agenda, ourMatches(matches, OUR_TEAM_NUMBER), now);

  return (
    <Card>
      <CardContent className="gap-4 p-5">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={CalendarClock} size={16} className="text-primary" />
            <Text variant="label" className="text-muted-foreground">
              Event schedule
            </Text>
          </View>
          {canEdit && eventCode ? (
            <Button variant="outline" size="sm" label="Edit" icon={Pencil} accessibilityLabel="Edit the event schedule" onPress={onEdit} />
          ) : null}
        </View>

        {!eventCode ? (
          <Text variant="muted">Sync an event in Settings to plan its schedule.</Text>
        ) : days.length === 0 ? (
          <View className="gap-1">
            <Text variant="muted">Nothing scheduled yet.</Text>
            {canEdit ? (
              <Text variant="small">Add arrival, inspection, the judging interview and ceremonies so everyone knows where to be.</Text>
            ) : null}
          </View>
        ) : (
          <View className="gap-4">
            {days.map((day) => (
              <View key={day.day} className="gap-1.5">
                <Text variant="small" className="font-semibold uppercase tracking-wider">
                  {formatDayLabel(new Date(day.entries[0].start).toISOString())}
                </Text>
                {day.entries.map((entry) => {
                  const badge = STATE_BADGE[entry.state];
                  const past = entry.state === 'past';
                  const sides = entry.kind === 'match' ? matchSides(entry.match, OUR_TEAM_NUMBER) : null;
                  return (
                    <View
                      key={entry.key}
                      className={cn(
                        'flex-row gap-3 rounded-md border px-3 py-2.5',
                        entry.state === 'now' ? 'border-success bg-success/10' : entry.state === 'next' ? 'border-primary/60 bg-primary/5' : 'border-border',
                        past && 'opacity-60'
                      )}
                    >
                      <View className="w-[92px]">
                        <Text className="text-sm font-semibold tabular-nums">
                          {entry.kind === 'agenda' ? timeRange(entry.item.start, entry.item.end) : formatTime(entry.match.scheduled_time!)}
                        </Text>
                      </View>
                      <View className="min-w-0 flex-1 gap-0.5">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className={cn('text-sm font-semibold', past && 'line-through')}>
                            {entry.kind === 'agenda' ? entry.item.title : `${matchTitle(entry.match)} · ${sides?.alliance === 'red' ? 'Red' : 'Blue'} alliance`}
                          </Text>
                          {badge ? <Badge variant={badge.variant} label={badge.label} /> : null}
                        </View>
                        {entry.kind === 'agenda' ? (
                          <>
                            <Text variant="small">
                              {kindLabel(entry.item.kind)}
                              {entry.item.location ? ` · ${entry.item.location}` : ''}
                            </Text>
                            {entry.item.notes && !past ? <Text variant="small" className="text-foreground">{entry.item.notes}</Text> : null}
                          </>
                        ) : sides ? (
                          <Text variant="small">
                            with {sides.partners.join(', ') || '—'} · vs {sides.opponents.join(', ')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

/** The judging interview (and any other judging slots): when, where, what to bring. */
export function JudgingCard({
  eventCode,
  agenda,
  canEdit,
  onAdd,
}: {
  eventCode: string;
  agenda: AgendaItem[];
  canEdit: boolean;
  onAdd: () => void;
}) {
  const now = useNow(30_000);
  const judging = agenda.filter((item) => item.kind === 'judging');
  const upcoming = judging.filter((item) => new Date(item.end ?? item.start).getTime() > now);
  if (!eventCode) return null;

  return (
    <Card>
      <CardContent className="gap-3 p-5">
        <View className="flex-row items-center gap-2">
          <Icon as={Gavel} size={16} className="text-primary" />
          <Text variant="label" className="text-muted-foreground">
            Judging
          </Text>
        </View>
        {judging.length === 0 ? (
          <View className="items-start gap-2">
            <Text variant="muted">No judging slot on the schedule yet.</Text>
            {canEdit ? <Button variant="outline" size="sm" label="Add judging interview" icon={Plus} onPress={onAdd} /> : null}
          </View>
        ) : upcoming.length === 0 ? (
          <View className="flex-row items-center gap-2">
            <Icon as={ClipboardCheck} size={16} className="text-success" />
            <Text>Judging is done. Awards are listed on the event card once they’re announced.</Text>
          </View>
        ) : (
          upcoming.map((item, index) => {
            const start = new Date(item.start).getTime();
            const live = start <= now;
            return (
              <View key={item.id} className={cn('gap-1.5', index > 0 && 'border-t border-border pt-3')}>
                <View className="flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Text className={cn('font-extrabold', index === 0 ? 'text-2xl text-primary' : 'text-lg')}>
                    {timeRange(item.start, item.end)}
                  </Text>
                  <Text variant="muted">
                    {formatDayLabel(item.start)} · {live ? 'happening now' : timeUntil(item.start, now)}
                  </Text>
                </View>
                <Text className="font-semibold">{item.title}</Text>
                {item.location ? (
                  <View className="flex-row items-center gap-1.5">
                    <Icon as={MapPin} size={14} className="text-muted-foreground" />
                    <Text variant="small" className="text-foreground">{item.location}</Text>
                  </View>
                ) : null}
                {item.notes ? <Text variant="small" className="text-foreground">{item.notes}</Text> : null}
              </View>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ---- Editor -------------------------------------------------------------------------

type Draft = {
  id: string | null;
  kind: AgendaKind;
  title: string;
  date: string | null;
  start: string;
  end: string;
  location: string;
  notes: string;
};

function newId() {
  return `agenda-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function draftFrom(item: AgendaItem): Draft {
  const start = splitLocalDateTime(item.start);
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    date: start.date,
    start: start.time,
    end: item.end ? splitLocalDateTime(item.end).time : '',
    location: item.location ?? '',
    notes: item.notes ?? '',
  };
}

/** Admins edit the agenda here; the whole list is saved at once. */
export function AgendaEditor({
  visible,
  onClose,
  eventCode,
  agenda,
  defaultDate,
  startWith,
}: {
  visible: boolean;
  onClose: () => void;
  eventCode: string;
  agenda: AgendaItem[];
  /** Day a new item starts on: the event's first day, or today. */
  defaultDate: string;
  /** Open straight on a new item of this kind. */
  startWith?: AgendaKind | null;
}) {
  const saver = useSaveEventAgenda();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [openedFor, setOpenedFor] = React.useState<boolean>(false);

  const blank = (kind: AgendaKind = 'other'): Draft => ({
    id: null,
    kind,
    title: kind === 'judging' ? 'Judging interview' : '',
    date: defaultDate,
    start: '',
    end: '',
    location: '',
    notes: '',
  });

  // Reset each time the editor opens.
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setDraft(startWith ? blank(startWith) : null);
      setError(null);
    }
  }

  const persist = async (items: AgendaItem[]) => {
    try {
      setError(null);
      await saver.save(eventCode, items);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the schedule.');
      return false;
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const title = draft.title.trim() || kindLabel(draft.kind);
    const startMinutes = parseClockTime(draft.start);
    if (!draft.date) return setError('Pick a day.');
    if (startMinutes === null) return setError('Enter a start time, like 9:30 or 2:15 PM.');
    const endMinutes = draft.end.trim() ? parseClockTime(draft.end) : null;
    if (draft.end.trim() && endMinutes === null) return setError('The end time is not a time. Leave it empty if there is none.');
    if (endMinutes !== null && endMinutes <= startMinutes) return setError('The end time must be after the start.');
    const start = localDateTime(draft.date, startMinutes)!;
    const item: AgendaItem = {
      id: draft.id ?? newId(),
      kind: draft.kind,
      title,
      start,
      end: endMinutes !== null ? localDateTime(draft.date, endMinutes) : null,
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
    };
    const items = [...agenda.filter((existing) => existing.id !== item.id), item].sort((a, b) => a.start.localeCompare(b.start));
    if (await persist(items)) setDraft(null);
  };

  const remove = async (id: string) => {
    await persist(agenda.filter((item) => item.id !== id));
  };

  const set = (patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

  return (
    <ModalSheet visible={visible} onClose={onClose}>
      <View className="w-full gap-4 rounded-md border border-border bg-card p-5">
        <View className="flex-row items-center justify-between">
          <Text variant="title">{draft ? (draft.id ? 'Edit schedule item' : 'Add to the schedule') : 'Event schedule'}</Text>
          <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Close" onPress={onClose} />
        </View>

        {draft ? (
          <View className="gap-3">
            <View className="gap-1.5">
              <Text variant="small" className="font-semibold">What</Text>
              <Select
                options={AGENDA_KINDS}
                value={draft.kind}
                onChange={(kind) =>
                  set({ kind, title: draft.title || (kind === 'judging' ? 'Judging interview' : draft.title) })
                }
              />
            </View>
            <View className="gap-1.5">
              <Text variant="small" className="font-semibold">Title</Text>
              <Input value={draft.title} onChangeText={(title) => set({ title })} placeholder={kindLabel(draft.kind)} />
            </View>
            <View className="gap-1.5">
              <Text variant="small" className="font-semibold">Day</Text>
              <DatePicker value={draft.date} placeholder="Pick a day" onChange={(date) => set({ date })} />
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1.5">
                <Text variant="small" className="font-semibold">Starts</Text>
                <Input value={draft.start} onChangeText={(start) => set({ start })} placeholder="9:30 AM" autoCapitalize="none" />
              </View>
              <View className="flex-1 gap-1.5">
                <Text variant="small" className="font-semibold">Ends (optional)</Text>
                <Input value={draft.end} onChangeText={(end) => set({ end })} placeholder="10:00 AM" autoCapitalize="none" />
              </View>
            </View>
            <View className="gap-1.5">
              <Text variant="small" className="font-semibold">Where (optional)</Text>
              <Input value={draft.location} onChangeText={(location) => set({ location })} placeholder="Room 112, pit 14, main gym…" />
            </View>
            <View className="gap-1.5">
              <Text variant="small" className="font-semibold">Notes (optional)</Text>
              <Textarea value={draft.notes} onChangeText={(notes) => set({ notes })} placeholder="What to bring, who goes" className="min-h-[72px]" />
            </View>
            {error ? <Text variant="small" className="text-destructive">{error}</Text> : null}
            <View className="flex-row justify-end gap-2">
              <Button variant="outline" label="Back" onPress={() => { setDraft(null); setError(null); }} />
              <Button label="Save" loading={saver.isPending} onPress={() => void saveDraft()} />
            </View>
          </View>
        ) : (
          <View className="gap-3">
            {agenda.length === 0 ? (
              <Text variant="muted">No items yet.</Text>
            ) : (
              <View className="gap-1">
                {agenda.map((item) => (
                  <View key={item.id} className="flex-row items-center gap-2 rounded-md border border-border px-3 py-2">
                    <Pressable className="min-w-0 flex-1 active:opacity-70" onPress={() => { setDraft(draftFrom(item)); setError(null); }}>
                      <Text numberOfLines={1} className="text-sm font-semibold">{item.title}</Text>
                      <Text variant="small">
                        {formatDayLabel(item.start)} · {timeRange(item.start, item.end)} · {kindLabel(item.kind)}
                      </Text>
                    </Pressable>
                    <Button variant="ghost" size="icon" icon={Pencil} accessibilityLabel={`Edit ${item.title}`} onPress={() => { setDraft(draftFrom(item)); setError(null); }} />
                    <Button variant="ghost" size="icon" icon={Trash2} accessibilityLabel={`Remove ${item.title}`} disabled={saver.isPending} onPress={() => void remove(item.id)} />
                  </View>
                ))}
              </View>
            )}
            {error ? <Text variant="small" className="text-destructive">{error}</Text> : null}
            <View className="flex-row justify-end">
              <Button label="Add item" icon={Plus} onPress={() => { setDraft(blank()); setError(null); }} />
            </View>
          </View>
        )}
      </View>
    </ModalSheet>
  );
}
