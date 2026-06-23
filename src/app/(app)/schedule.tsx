import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { CalendarClock, Wand2, Trash2, X } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { OptionChips } from '@/components/ui/option-chips';
import { cn } from '@/lib/utils';
import { formatTime, formatDayLabel } from '@/lib/format';
import { generateSchedule } from '@/lib/scheduler';
import { useProfiles } from '@/lib/queries/profiles';
import {
  usePitShifts,
  useReplaceSchedule,
  useClearSchedule,
  useReassignShift,
  useDeleteShift,
  type ShiftWithAssignee,
} from '@/lib/queries/schedule';
import type { Profile } from '@/lib/types';

const SHIFT_LENGTHS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '90 min' },
];
const PER_SHIFT = [
  { value: '1', label: '1 person' },
  { value: '2', label: '2 people' },
  { value: '3', label: '3 people' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Generator({ members, onClose }: { members: Profile[]; onClose: () => void }) {
  const replace = useReplaceSchedule();
  const [date, setDate] = React.useState(todayISO());
  const [startT, setStartT] = React.useState('08:00');
  const [endT, setEndT] = React.useState('17:00');
  const [len, setLen] = React.useState('60');
  const [per, setPer] = React.useState('1');
  const [selected, setSelected] = React.useState<Set<string> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const effective = selected ?? new Set(members.map((m) => m.id));
  const toggle = (id: string) => {
    const next = new Set(effective);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onGenerate = async () => {
    setError(null);
    const start = new Date(`${date}T${startT}`);
    const end = new Date(`${date}T${endT}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Use date YYYY-MM-DD and times HH:MM.');
      return;
    }
    if (end <= start) {
      setError('End time must be after start time.');
      return;
    }
    const memberIds = [...effective];
    if (memberIds.length === 0) {
      setError('Select at least one person.');
      return;
    }
    const shifts = generateSchedule({
      start,
      end,
      shiftMinutes: parseInt(len, 10),
      peoplePerShift: parseInt(per, 10),
      memberIds,
    });
    if (shifts.length === 0) {
      setError('That window is shorter than one shift.');
      return;
    }
    await replace.mutateAsync(shifts);
    onClose();
  };

  return (
    <Card className="border-primary/40">
      <CardContent className="gap-3 p-4">
        <Text variant="title">Generate rotation</Text>
        <View className="gap-1.5">
          <Text variant="label">Date</Text>
          <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Text variant="label">Start</Text>
            <Input value={startT} onChangeText={setStartT} placeholder="08:00" autoCapitalize="none" />
          </View>
          <View className="flex-1 gap-1.5">
            <Text variant="label">End</Text>
            <Input value={endT} onChangeText={setEndT} placeholder="17:00" autoCapitalize="none" />
          </View>
        </View>
        <View className="gap-1.5">
          <Text variant="label">Shift length</Text>
          <OptionChips options={SHIFT_LENGTHS} value={len} onChange={setLen} />
        </View>
        <View className="gap-1.5">
          <Text variant="label">People per shift</Text>
          <OptionChips options={PER_SHIFT} value={per} onChange={setPer} />
        </View>
        <View className="gap-1.5">
          <Text variant="label">Who’s available ({effective.size})</Text>
          <View className="flex-row flex-wrap gap-2">
            {members.map((m) => {
              const active = effective.has(m.id);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => toggle(m.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5',
                    active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
                  )}
                >
                  <Text className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
                    {m.full_name ?? 'Member'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text className="text-destructive">{error}</Text> : null}

        <View className="flex-row gap-2">
          <Button variant="ghost" label="Cancel" onPress={onClose} className="flex-1" />
          <Button label="Generate" icon={Wand2} loading={replace.isPending} onPress={onGenerate} className="flex-1" />
        </View>
      </CardContent>
    </Card>
  );
}

function ShiftRow({ shift, members }: { shift: ShiftWithAssignee; members: Profile[] }) {
  const reassign = useReassignShift();
  const del = useDeleteShift();
  const [editing, setEditing] = React.useState(false);

  return (
    <Card>
      <CardContent className="gap-2 p-3">
        <View className="flex-row items-center gap-3">
          <View className="w-28">
            <Text className="text-sm font-semibold">{formatTime(shift.start_time)}</Text>
            <Text variant="small">to {formatTime(shift.end_time)}</Text>
          </View>
          <Pressable className="flex-1 flex-row items-center gap-2" onPress={() => setEditing((e) => !e)}>
            {shift.assignee ? (
              <>
                <Avatar name={shift.assignee.full_name} uri={shift.assignee.avatar_url} size={24} />
                <Text className="text-sm font-medium">{shift.assignee.full_name ?? 'Member'}</Text>
              </>
            ) : (
              <Text variant="muted">Unassigned — tap to set</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => del.mutate(shift.id)}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-accent"
          >
            <Icon as={Trash2} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>

        {editing ? (
          <View className="flex-row flex-wrap gap-2 border-t border-border pt-2">
            {members.map((m) => {
              const active = shift.assignee_id === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    reassign.mutate({ id: shift.id, assigneeId: active ? null : m.id });
                    setEditing(false);
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5',
                    active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
                  )}
                >
                  <Text className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
                    {m.full_name ?? 'Member'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ScheduleScreen() {
  const { data: shifts, isLoading } = usePitShifts();
  const { data: profiles } = useProfiles();
  const clear = useClearSchedule();
  const [showGen, setShowGen] = React.useState(false);

  const members = (profiles ?? []).filter((p) => p.status === 'approved');
  const list = shifts ?? [];

  // Group shifts by day.
  const days: { label: string; shifts: ShiftWithAssignee[] }[] = [];
  for (const s of list) {
    const label = formatDayLabel(s.start_time);
    let g = days.find((d) => d.label === label);
    if (!g) {
      g = { label, shifts: [] };
      days.push(g);
    }
    g.shifts.push(s);
  }

  return (
    <Screen>
      <ScreenHeader title="Pit schedule" description="Fair rotations for who staffs the pit.">
        {list.length > 0 ? (
          <Button
            variant="outline"
            size="icon"
            icon={Trash2}
            accessibilityLabel="Clear schedule"
            loading={clear.isPending}
            onPress={() => clear.mutate()}
          />
        ) : null}
        {!showGen ? <Button label="Generate" icon={Wand2} onPress={() => setShowGen(true)} /> : null}
      </ScreenHeader>

      {showGen ? <Generator members={members} onClose={() => setShowGen(false)} /> : null}

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : list.length === 0 && !showGen ? (
        <EmptyState
          icon={CalendarClock}
          title="No shifts scheduled"
          description="Set your competition hours and shift length, and the app builds a balanced pit-duty rotation across your team."
        >
          <Button label="Generate schedule" icon={Wand2} onPress={() => setShowGen(true)} />
        </EmptyState>
      ) : (
        days.map((d) => (
          <View key={d.label} className="gap-2">
            <Text variant="title">{d.label}</Text>
            {d.shifts.map((s) => (
              <ShiftRow key={s.id} shift={s} members={members} />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}
