import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CalendarClock, Wand2, Trash2 } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { Avatar } from '@/components/ui/avatar';
import { OptionChips } from '@/components/ui/option-chips';
import { MultiSelect, Select, type SelectOption } from '@/components/ui/select';
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

function Generator({ options, onClose }: { options: SelectOption<string>[]; onClose: () => void }) {
  const replace = useReplaceSchedule();
  const [date, setDate] = React.useState(todayISO());
  const [startT, setStartT] = React.useState('08:00');
  const [endT, setEndT] = React.useState('17:00');
  const [len, setLen] = React.useState('60');
  const [per, setPer] = React.useState('1');
  const [selected, setSelected] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const effective = selected ?? options.map((o) => o.value);

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
    if (effective.length === 0) {
      setError('Select at least one person.');
      return;
    }
    const shifts = generateSchedule({
      start,
      end,
      shiftMinutes: parseInt(len, 10),
      peoplePerShift: parseInt(per, 10),
      memberIds: effective,
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
          <Text variant="label">Who’s available ({effective.length})</Text>
          <MultiSelect options={options} values={effective} onChange={setSelected} placeholder="No one selected" />
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

function ShiftRow({ shift, options }: { shift: ShiftWithAssignee; options: SelectOption<string>[] }) {
  const reassign = useReassignShift();
  const del = useDeleteShift();

  return (
    <Card>
      <CardContent className="p-3">
        <View className="flex-row items-center gap-3">
          <View className="w-28">
            <Text className="text-sm font-semibold">{formatTime(shift.start_time)}</Text>
            <Text variant="small">to {formatTime(shift.end_time)}</Text>
          </View>
          {shift.assignee ? <Avatar name={shift.assignee.full_name} uri={shift.assignee.avatar_url} size={24} /> : null}
          <Select
            className="flex-1"
            options={options}
            value={shift.assignee_id ?? 'none'}
            onChange={(v) => reassign.mutate({ id: shift.id, assigneeId: v === 'none' ? null : v })}
          />
          <DeleteButton
            variant="ghost"
            size="icon"
            onPress={() => del.mutate(shift.id)}
            className="h-8 w-8 rounded-sm"
            accessibilityLabel="Delete shift"
          />
        </View>
      </CardContent>
    </Card>
  );
}

export default function ScheduleScreen() {
  const { data: shifts, isLoading } = usePitShifts();
  const { data: profiles } = useProfiles();
  const clear = useClearSchedule();
  const [showGen, setShowGen] = React.useState(false);

  const memberOptions = (profiles ?? [])
    .filter((p) => p.status === 'approved')
    .map((p) => ({ value: p.id, label: p.full_name ?? 'Member' }));
  const shiftAssigneeOptions = [{ value: 'none', label: 'Unassigned' }, ...memberOptions];
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
          <DeleteButton
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

      {showGen ? <Generator options={memberOptions} onClose={() => setShowGen(false)} /> : null}

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
              <ShiftRow key={s.id} shift={s} options={shiftAssigneeOptions} />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}
