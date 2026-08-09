import * as React from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ChevronLeft,
  CircleDot,
  Flag,
  FolderX,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  ChevronRight,
  ListFilter,
  X,
  Tag,
  Check,
  FileText,
  Ban,
} from 'lucide-react-native';
import {
  Screen,
  ScreenHeader,
  useScreenDragActive,
  useScreenDragController,
} from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { AutoGrowingTextInput } from '@/components/ui/auto-growing-text-input';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { OptionChips } from '@/components/ui/option-chips';
import { MultiSelect, Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { FadeModal, FADE_DURATION_MS } from '@/components/ui/fade-modal';
import { MobileDragSurface } from '@/components/mobile-drag-surface';
import { cn } from '@/lib/utils';
import { useColorScheme } from '@/lib/theme';
import { useProfiles } from '@/lib/queries/profiles';
import {
  useProject,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTasks,
  useUpdateProject,
  useTrashProject,
} from '@/lib/queries/tasks';
import { priorityVariant, projectStatusVariant, taskStatusVariant, labelOf } from '@/lib/task-style';
import { nextTaskSortOrder } from '@/lib/task-order';
import {
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  type Priority,
  type Profile,
  type Task,
  type TaskStatus,
} from '@/lib/types';
import { getNativeDropTarget } from '@/lib/native-reorder';
import {
  hapticReorderDrop,
  hapticReorderPickup,
  hapticReorderTargetChange,
} from '@/lib/reorder-haptics';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMPLETED_LINE_DURATION_MS = 250;
const COMPLETED_LINE_HEIGHT =
  Platform.OS === 'web' ? 1 / PixelRatio.get() : StyleSheet.hairlineWidth;
const TABLE_BORDER_RIGHT_OUTSET = Platform.OS === 'web' ? 1 / PixelRatio.get() : 0;
const TASK_TABLE_MIN_WIDTH = 836;
const TASK_TABLE_COLUMNS = {
  task: 'min-w-[220px] flex-[2]',
  status: 'min-w-[112px] flex-1',
  assignees: 'min-w-[136px] flex-[1.25]',
  dueDate: 'min-w-[104px] flex-1',
  priority: 'min-w-[96px] flex-[0.9]',
  tags: 'min-w-[120px] flex-[1.15]',
  actions: 'w-12 flex-none',
} as const;

type FilterGroup = {
  key: string;
  label: string;
  value: string;
  /** First option is the group's "no filter" reset. */
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

/**
 * One filter button anchored to a popup: group tabs on the left, the active
 * group's options on the right. Window coords measured off the button keep the
 * popup pinned to it, while the modal handles layering and click-away.
 */
function FilterMenu({ groups }: { groups: FilterGroup[] }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const [tab, setTab] = React.useState(groups[0].key);
  const btnRef = React.useRef<View>(null);
  const active = groups.find((g) => g.key === tab) ?? groups[0];
  const isSet = (g: FilterGroup) => g.value !== g.options[0].value;

  const openMenu = () =>
    btnRef.current?.measureInWindow((x, y, _w, h) => {
      setPos({ left: x, top: y + h + 4 });
      setOpen(true);
    });

  return (
    <View ref={btnRef} collapsable={false}>
      <Button
        variant={groups.some(isSet) ? 'default' : 'outline'}
        size="sm"
        icon={ListFilter}
        label="Filter"
        onPress={openMenu}
      />
      {pos ? (
        <FadeModal
          visible={open}
          onRequestClose={() => setOpen(false)}
          onDismiss={() => setPos(null)}
        >
          <Pressable className="flex-1" onPress={() => setOpen(false)}>
            <View className="absolute flex-row rounded-md border border-border bg-popover" style={pos}>
              <View className="w-32 p-1">
                {groups.map((g) => (
                  <Pressable
                    key={g.key}
                    onHoverIn={() => setTab(g.key)}
                    onPress={() => setTab(g.key)}
                    className={cn(
                      'flex-row items-center gap-1.5 rounded-sm px-2.5 py-2',
                      g.key === tab ? 'bg-accent' : 'active:bg-accent'
                    )}
                  >
                    <Text className="flex-1 text-[13px] font-semibold">{g.label}</Text>
                    {isSet(g) ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                    <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
                  </Pressable>
                ))}
              </View>
              <ScrollView className="max-h-72 w-48 border-l border-border" contentContainerClassName="p-1">
                {active.options.map((o) => (
                  <Pressable
                    key={o.value}
                    onPress={() => active.onChange(o.value)}
                    className={cn(
                      'flex-row items-center gap-2 rounded-sm px-2.5 py-2',
                      o.value === active.value ? 'bg-accent' : 'active:bg-accent'
                    )}
                  >
                    <Text className="flex-1 text-[13px] font-medium" numberOfLines={1}>
                      {o.label}
                    </Text>
                    {o.value === active.value ? <Icon as={Check} size={14} className="text-primary" /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </FadeModal>
      ) : null}
    </View>
  );
}

/** Centered scrollable overlay; the backdrop dismisses, the sheet swallows taps. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ModalSheet({
  visible,
  onClose,
  onDismiss,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  return (
    <FadeModal visible={visible} onRequestClose={onClose} onDismiss={onDismiss}>
      <Pressable className="flex-1 justify-center bg-black/50 p-4" onPress={onClose}>
        <Pressable className="max-h-[85%] w-full max-w-lg self-center" onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </FadeModal>
  );
}

/** Picks the sibling task that a blocked task is waiting on. */
function BlockerSelect({
  siblings,
  value,
  onChange,
}: {
  siblings: Task[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text variant="label">Blocked by</Text>
      {siblings.length === 0 ? (
        <Text variant="small">No other task in this project to wait on.</Text>
      ) : (
        <Select
          options={[{ value: 'none', label: 'Unspecified' }, ...siblings.map((t) => ({ value: t.id, label: t.title }))]}
          value={value ?? 'none'}
          onChange={(v) => onChange(v === 'none' ? null : v)}
        />
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TaskEditor({
  projectId,
  projectName,
  members,
  siblings,
  initial,
  onDone,
}: {
  projectId: string;
  projectName: string;
  members: Profile[];
  siblings: Task[];
  initial?: Task;
  onDone: (createdId?: string) => void;
}) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [status, setStatus] = React.useState<TaskStatus>(initial?.status ?? 'todo');
  const [priority, setPriority] = React.useState<Priority>(initial?.priority ?? 'medium');
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>(initial?.assignee_ids ?? []);
  const [blockedBy, setBlockedBy] = React.useState<string | null>(initial?.blocked_by ?? null);
  const [dueDate, setDueDate] = React.useState(initial?.due_date?.slice(0, 10) ?? '');
  const [tags, setTags] = React.useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const addTag = () => {
    const parts = tagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length) setTags((prev) => Array.from(new Set([...prev, ...parts])));
    setTagInput('');
  };

  // Synchronous re-entrancy guard: disabled={busy} only takes effect on the
  // next render, so a fast double-click can submit twice in the same frame —
  // duplicating the task and its assignment notification.
  const submitting = React.useRef(false);

  /** Saves, then hands back a task id when the notes page should open next. */
  const onSave = async (openNotes = false) => {
    if (submitting.current) return;
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (dueDate && !DATE_RE.test(dueDate.trim())) {
      setError('Due date must be YYYY-MM-DD.');
      return;
    }
    const fields = {
      title: title.trim(),
      status,
      priority,
      assignee_ids: assigneeIds,
      blocked_by: status === 'blocked' ? blockedBy : null,
      blocked_by_project: null,
      due_date: dueDate.trim() || null,
      tags,
    };
    submitting.current = true;
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...fields });
        onDone(openNotes ? initial.id : undefined);
      } else {
        // Same top-of-list rule as the quick "Add task" button. Without an
        // explicit value the row falls back to the column default of 0, which
        // sits below anything already created this way.
        onDone(
          await create.mutateAsync({
            project_id: projectId,
            projectName,
            notes: null,
            ...fields,
            sort_order: nextTaskSortOrder(siblings),
          })
        );
      }
    } finally {
      submitting.current = false;
    }
  };

  return (
    <Card className="border-primary/40">
      <CardContent className="gap-3 p-4">
        <Text variant="title">{initial ? 'Edit task' : 'New task'}</Text>
        <Input value={title} onChangeText={setTitle} placeholder="Task title" />

        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Text variant="label">Status</Text>
            <Select options={TASK_STATUSES} value={status} onChange={setStatus} />
          </View>
          <View className="flex-1 gap-1.5">
            <Text variant="label">Priority</Text>
            <Select options={PRIORITIES} value={priority} onChange={setPriority} />
          </View>
        </View>
        {status === 'blocked' ? <BlockerSelect siblings={siblings} value={blockedBy} onChange={setBlockedBy} /> : null}
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Text variant="label">Assignees</Text>
            <MultiSelect
              options={members.map((m) => ({ value: m.id, label: m.full_name ?? 'Member' }))}
              values={assigneeIds}
              onChange={setAssigneeIds}
              placeholder="Unassigned"
            />
          </View>
          <View className="flex-1 gap-1.5">
            <Text variant="label">Due date</Text>
            <Input value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          </View>
        </View>
        <View className="gap-1.5">
          <Text variant="label">Tags</Text>
          <View className="flex-row flex-wrap gap-2">
            {tags.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTags((prev) => prev.filter((x) => x !== t))}
                className="flex-row items-center gap-1 rounded-sm bg-secondary px-2.5 py-1"
              >
                <Text className="text-xs font-semibold text-secondary-foreground">{t}</Text>
                <Icon as={X} size={12} className="text-secondary-foreground" />
              </Pressable>
            ))}
          </View>
          <Input
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={addTag}
            onBlur={addTag}
            placeholder="Add a tag and press enter"
            autoCapitalize="none"
          />
        </View>

        {error ? <Text className="text-destructive">{error}</Text> : null}

        <View className="flex-row gap-2">
          <Button variant="ghost" label="Cancel" onPress={() => onDone()} className="flex-1" />
          {initial ? (
            <Button
              variant="outline"
              label="Notes"
              icon={FileText}
              disabled={busy}
              onPress={() => onSave(true)}
              className="flex-1"
            />
          ) : null}
          <Button
            label={initial ? 'Save' : 'Add and open notes'}
            loading={busy}
            disabled={busy}
            onPress={() => onSave()}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TaskCard({
  task,
  siblings,
  profiles,
  onEdit,
  highlighted = false,
}: {
  task: Task;
  siblings: Task[];
  profiles: Profile[];
  onEdit: () => void;
  highlighted?: boolean;
}) {
  const router = useRouter();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const assignees = profiles.filter((p) => task.assignee_ids.includes(p.id));
  const blocker = siblings.find((t) => t.id === task.blocked_by);

  // Finishing a task deletes it — fade the card first so it doesn't blink out.
  const shown = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.98 + shown.value * 0.02 }],
  }));
  const remove = () => del.mutate(task.id);
  const openNotes = () => router.push(`/projects/${task.project_id}/${task.id}` as any);
  const complete = () => {
    // eslint-disable-next-line react-hooks/immutability -- shared values are mutable containers
    shown.value = withTiming(0, { duration: FADE_DURATION_MS }, (finished) => {
      if (finished) runOnJS(remove)();
    });
  };

  return (
    <Animated.View style={style}>
      <Card className={highlighted ? 'border-primary' : undefined}>
        <CardContent className="gap-3 p-4">
          <Pressable className="flex-row items-start gap-2 active:opacity-70" onPress={openNotes}>
            <Text className="flex-1 font-semibold">{task.title}</Text>
            {task.notes ? <Icon as={FileText} size={15} className="mt-0.5 text-muted-foreground" /> : null}
            <Badge variant={priorityVariant(task.priority)} label={labelOf(PRIORITIES, task.priority)} />
          </Pressable>

          <View className="flex-row flex-wrap items-center gap-3">
            {assignees.length > 0 ? (
              assignees.map((a) => (
                <View key={a.id} className="flex-row items-center gap-1.5">
                  <Avatar name={a.full_name} uri={a.avatar_url} size={20} />
                  <Text variant="small">{a.full_name ?? 'Member'}</Text>
                </View>
              ))
            ) : (
              <Text variant="small">Unassigned</Text>
            )}
            {task.due_date ? (
              <View className="flex-row items-center gap-1">
                <Icon as={Calendar} size={14} className="text-muted-foreground" />
                <Text variant="small">{task.due_date}</Text>
              </View>
            ) : null}
          </View>

          {task.tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {task.tags.map((t) => (
                <View key={t} className="flex-row items-center gap-1 rounded-sm bg-muted px-2 py-0.5">
                  <Icon as={Tag} size={11} className="text-muted-foreground" />
                  <Text variant="small">{t}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {task.status === 'blocked' ? (
            <View className="flex-row items-center gap-1.5">
              <Icon as={Ban} size={14} className="text-destructive" />
              <Text variant="small" className="flex-1">
                {blocker ? `Blocked by ${blocker.title}` : 'Blocked — set the blocking task under Edit'}
              </Text>
            </View>
          ) : null}

          <OptionChips
            options={TASK_STATUSES}
            value={task.status}
            onChange={(s) =>
              update.mutate({
                id: task.id,
                status: s,
                blocked_by: s === 'blocked' ? task.blocked_by : null,
                blocked_by_project: s === 'blocked' ? task.blocked_by_project : null,
              })
            }
          />
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" label="Done" icon={Check} disabled={del.isPending} onPress={complete} className="flex-1 basis-24" />
            <Button variant="outline" size="sm" label="Notes" icon={FileText} onPress={openNotes} className="flex-1 basis-24" />
            <Button variant="outline" size="sm" label="Edit" icon={Pencil} onPress={onEdit} className="flex-1 basis-24" />
            <DeleteButton
              variant="outline"
              size="sm"
              icon={Trash2}
              accessibilityLabel="Delete task"
              disabled={del.isPending}
              onPress={remove}
            />
          </View>
        </CardContent>
      </Card>
    </Animated.View>
  );
}

function InlineTagsEditor({
  tags,
  onChange,
  onOpenChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const joined = tags.join(', ');
  const [editing, setEditing] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [draft, setDraft] = React.useState(joined);

  const save = () => {
    const next = Array.from(
      new Set(
        draft
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
      )
    );
    if (next.join(', ') !== joined) onChange(next);
    setEditing(false);
    onOpenChange(false);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChangeText={setDraft}
        onBlur={save}
        onSubmitEditing={save}
        placeholder="Comma-separated tags"
        autoCapitalize="none"
        className="h-10 rounded-md border-transparent bg-transparent px-1 outline-none focus:border-transparent"
      />
    );
  }

  return (
    <Pressable
      onPress={() => {
        setDraft(joined);
        setEditing(true);
        onOpenChange(true);
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className={cn(
        'min-h-10 w-full flex-row flex-wrap content-center gap-1 rounded-md px-1 py-1 active:bg-accent',
        hovered && 'bg-accent'
      )}
    >
      {tags.length > 0 ? (
        tags.map((tag) => <Badge key={tag} variant="muted" label={tag} />)
      ) : (
        <Text variant="small">No tags</Text>
      )}
    </Pressable>
  );
}

function TaskTableRow({
  task,
  profiles,
  highlighted = false,
  onMetadataOpenChange,
  onOpen,
}: {
  task: Task;
  profiles: Profile[];
  highlighted?: boolean;
  onMetadataOpenChange: (open: boolean) => void;
  onOpen: () => void;
}) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [rowHeight, setRowHeight] = React.useState(0);
  const [rowWidth, setRowWidth] = React.useState(0);
  const completed = task.status === 'done';
  const previousCompleted = React.useRef(completed);
  const completedLineProgress = useSharedValue(1);
  const completedCellClass = completed ? 'opacity-60' : undefined;
  const completedLineTop = PixelRatio.roundToNearestPixel(
    (rowHeight - COMPLETED_LINE_HEIGHT) / 2
  );
  const completedLineAnimatedStyle = useAnimatedStyle(() => {
    const progress = completedLineProgress.value;
    const extension = Platform.OS === 'web' ? 16 : rowWidth * 0.015;
    return {
      transform: [
        {
          translateX:
            ((progress - 1) * rowWidth) / 2 - extension * (1 - progress),
        },
        {
          scaleX: progress * (Platform.OS === 'web' ? 1 : 1.03),
        },
      ],
    };
  });
  const assigneeOptions = profiles.map((profile) => ({
    value: profile.id,
    label: profile.full_name ?? 'Member',
  }));
  React.useLayoutEffect(() => {
    if (completed && !previousCompleted.current) {
      completedLineProgress.value = 0;
      completedLineProgress.value = withTiming(1, {
        duration: COMPLETED_LINE_DURATION_MS,
      });
    } else if (!completed) {
      completedLineProgress.value = 1;
    }
    previousCompleted.current = completed;
  }, [completed, completedLineProgress]);

  return (
    <View
      className={cn(
        'relative min-h-14 flex-row items-stretch border-t border-border',
        highlighted ? 'bg-primary/10 hover:bg-primary/12' : 'hover:bg-accent/70'
      )}
      onLayout={(event) => {
        setRowHeight(event.nativeEvent.layout.height);
        setRowWidth(event.nativeEvent.layout.width);
      }}
    >
      {Platform.OS === 'web' && completed && rowHeight > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              zIndex: 10,
              height: COMPLETED_LINE_HEIGHT,
              top: completedLineTop,
            },
            completedLineAnimatedStyle,
          ]}
        >
          <View
            className="h-full w-full bg-foreground text-foreground opacity-60"
            style={
              Platform.OS === 'web'
                ? ({ boxShadow: '-16px 0 0 currentColor, 16px 0 0 currentColor' } as any)
                : undefined
            }
          />
        </Animated.View>
      ) : null}

      <View
        className={cn(
          TASK_TABLE_COLUMNS.task,
          'justify-center px-3 py-2.5',
          completedCellClass
        )}
      >
        <Pressable className="flex-row items-center gap-2 active:opacity-70" onPress={onOpen}>
          <Text className="flex-1 text-sm font-semibold">{task.title}</Text>
        </Pressable>
      </View>

      <View
        className={cn(
          TASK_TABLE_COLUMNS.status,
          'justify-center px-2 py-2',
          completedCellClass
        )}
      >
        <Select
          options={TASK_STATUSES}
          value={task.status}
          onChange={(status: TaskStatus) =>
            update.mutate({
              id: task.id,
              status,
              blocked_by: status === 'blocked' ? task.blocked_by : null,
              blocked_by_project: status === 'blocked' ? task.blocked_by_project : null,
            })
          }
          renderValue={(option) => (
            <Badge variant={taskStatusVariant(option.value)} label={option.label} />
          )}
          className="h-10 gap-1 rounded-md border-transparent bg-transparent px-1"
          onOpenChange={onMetadataOpenChange}
        />
      </View>

      <View
        className={cn(
          TASK_TABLE_COLUMNS.assignees,
          'justify-center px-2 py-2',
          completedCellClass
        )}
      >
        <MultiSelect
          options={assigneeOptions}
          values={task.assignee_ids}
          onChange={(assignee_ids) => update.mutate({ id: task.id, assignee_ids })}
          placeholder="Unassigned"
          className="h-auto min-h-10 gap-1 rounded-md border-transparent bg-transparent px-1 py-1"
          renderValue={(selectedOptions) => (
            <View className="flex-row flex-wrap gap-2">
              {selectedOptions.map((option) => {
                const assignee = profiles.find((profile) => profile.id === option.value);
                return (
                  <View key={option.value} className="max-w-full flex-row items-center gap-1.5">
                    <Avatar
                      name={assignee?.full_name}
                      uri={assignee?.avatar_url}
                      size={24}
                    />
                    <Text variant="small" className="shrink">
                      {option.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
          renderOption={(option) => {
            const assignee = profiles.find((profile) => profile.id === option.value);
            return (
              <View className="flex-row items-center gap-2">
                <Avatar name={assignee?.full_name} uri={assignee?.avatar_url} size={24} />
                <Text className="text-sm font-medium">{option.label}</Text>
              </View>
            );
          }}
          renderSelectedOption={(option) => {
            const assignee = profiles.find((profile) => profile.id === option.value);
            return (
              <View className="flex-row items-center gap-1.5">
                <Avatar name={assignee?.full_name} uri={assignee?.avatar_url} size={20} />
                <Text className="text-sm font-medium">{option.label}</Text>
              </View>
            );
          }}
          onOpenChange={onMetadataOpenChange}
        />
      </View>

      <View
        className={cn(
          TASK_TABLE_COLUMNS.dueDate,
          'justify-center px-2 py-2',
          completedCellClass
        )}
      >
        <DatePicker
          compact
          value={task.due_date}
          onChange={(due_date) => update.mutate({ id: task.id, due_date })}
          className="border-transparent bg-transparent px-1"
          onOpenChange={onMetadataOpenChange}
        />
      </View>

      <View
        className={cn(
          TASK_TABLE_COLUMNS.priority,
          'justify-center px-2 py-2',
          completedCellClass
        )}
      >
        <Select
          options={PRIORITIES}
          value={task.priority}
          onChange={(priority) => update.mutate({ id: task.id, priority })}
          renderValue={(option) => (
            <Badge variant={priorityVariant(option.value)} label={option.label} />
          )}
          className="h-10 gap-1 rounded-md border-transparent bg-transparent px-1"
          onOpenChange={onMetadataOpenChange}
        />
      </View>

      <View
        className={cn(
          TASK_TABLE_COLUMNS.tags,
          'justify-center px-2 py-2',
          completedCellClass
        )}
      >
        <InlineTagsEditor
          tags={task.tags}
          onChange={(tags) => update.mutate({ id: task.id, tags })}
          onOpenChange={onMetadataOpenChange}
        />
      </View>

      <View
        className={cn(
          TASK_TABLE_COLUMNS.actions,
          'items-center justify-center px-1',
          completedCellClass
        )}
      >
        <DeleteButton
          variant="ghost"
          size="icon"
          icon={Trash2}
          accessibilityLabel={`Delete ${task.title}`}
          disabled={del.isPending}
          onPress={() => del.mutate(task.id)}
        />
      </View>
    </View>
  );
}

function NativeCompletedTaskLine({
  completed,
  layout,
  tableWidth,
  scrollX,
}: {
  completed: boolean;
  layout?: { y: number; height: number };
  tableWidth: number;
  scrollX: SharedValue<number>;
}) {
  const previousCompleted = React.useRef(completed);
  const progress = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => {
    const extension = tableWidth * 0.015;
    const lineProgress = progress.value;
    return {
      opacity: completed && layout && tableWidth > 0 ? 0.6 : 0,
      transform: [
        {
          translateX:
            -scrollX.value +
            ((lineProgress - 1) * tableWidth) / 2 -
            extension * (1 - lineProgress),
        },
        { scaleX: lineProgress * 1.03 },
      ],
    };
  });

  React.useLayoutEffect(() => {
    if (completed && !previousCompleted.current) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: COMPLETED_LINE_DURATION_MS,
      });
    } else if (!completed) {
      progress.value = 1;
    }
    previousCompleted.current = completed;
  }, [completed, progress]);

  if (!layout || tableWidth <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute left-0 z-30 bg-foreground"
      style={[
        {
          top: PixelRatio.roundToNearestPixel(
            layout.y + (layout.height - COMPLETED_LINE_HEIGHT) / 2
          ),
          width: tableWidth,
          height: COMPLETED_LINE_HEIGHT,
        },
        animatedStyle,
      ]}
    />
  );
}

function TaskTable({
  tasks,
  profiles,
  focusTaskId,
  onReorder,
  onOpenTask,
}: {
  tasks: Task[];
  profiles: Profile[];
  focusTaskId: string | null;
  onReorder: (taskIds: string[]) => void;
  onOpenTask: (task: Task) => void;
}) {
  const screenDragActive = useScreenDragActive();
  const screenDragController = useScreenDragController();
  type PointerDrag = {
    taskId: string;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    sourceElement: HTMLElement;
    ghost: HTMLElement | null;
    line: HTMLElement | null;
    insertionIndex: number | null;
    markerTaskId: string | null;
    markerEdge: 'before' | 'after' | null;
    moveListener: ((event: PointerEvent) => void) | null;
    endListener: ((event: PointerEvent) => void) | null;
    cancelListener: ((event: PointerEvent) => void) | null;
  };

  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [nativeTableWidth, setNativeTableWidth] = React.useState(0);
  const [nativeLineLayouts, setNativeLineLayouts] = React.useState<
    Record<string, { y: number; height: number }>
  >({});
  const horizontalScrollX = useSharedValue(0);
  const nativeIndicatorY = useSharedValue(0);
  const nativeIndicatorOpacity = useSharedValue(0);
  const nativeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: nativeIndicatorOpacity.value,
    transform: [{ translateY: nativeIndicatorY.value }],
  }));
  const [openMetadataTaskIds, setOpenMetadataTaskIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const pointerDrag = React.useRef<PointerDrag | null>(null);
  const nativeLayouts = React.useRef(
    new Map<string, { y: number; height: number }>()
  );
  const nativeDrag = React.useRef<{
    taskId: string;
    listTop: number;
    startScrollOffset: number;
    insertionIndex: number;
    targetKey: string | null;
  } | null>(null);
  const suppressNextClick = React.useRef(false);

  React.useEffect(() => {
    if (!draggingId || typeof document === 'undefined') return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    document.getSelection()?.removeAllRanges();
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [draggingId]);

  const clearDragVisuals = () => {
    const drag = pointerDrag.current;
    drag?.ghost?.remove();
    drag?.line?.remove();
    if (drag?.moveListener) window.removeEventListener('pointermove', drag.moveListener);
    if (drag?.endListener) window.removeEventListener('pointerup', drag.endListener);
    if (drag?.cancelListener) window.removeEventListener('pointercancel', drag.cancelListener);
    pointerDrag.current = null;
    setDraggingId(null);
  };

  const reorderAt = (taskId: string, insertionIndex: number) => {
    const fromIndex = tasks.findIndex((task) => task.id === taskId);
    if (fromIndex < 0) return;
    const reordered = [...tasks];
    const [dragged] = reordered.splice(fromIndex, 1);
    reordered.splice(insertionIndex, 0, dragged);
    if (reordered.some((task, index) => task.id !== tasks[index]?.id)) {
      onReorder(reordered.map((task) => task.id));
    }
  };

  const moveNativeDrag = (absoluteY: number, notifyTargetChange = true) => {
    const drag = nativeDrag.current;
    if (!drag) return;
    const contentY =
      absoluteY -
      drag.listTop +
      (screenDragController.getScrollOffset() - drag.startScrollOffset);
    const target = getNativeDropTarget(
      tasks.map((task) => task.id),
      drag.taskId,
      nativeLayouts.current,
      contentY
    );
    const targetKey = `${target.itemId}:${target.edge}:${target.insertionIndex}`;
    if (
      notifyTargetChange &&
      drag.targetKey !== null &&
      drag.targetKey !== targetKey
    ) {
      hapticReorderTargetChange();
    }
    drag.targetKey = targetKey;
    drag.insertionIndex = target.insertionIndex;
    const targetLayout = nativeLayouts.current.get(target.itemId);
    if (targetLayout) {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      nativeIndicatorY.value =
        target.edge === 'before'
          ? targetLayout.y - 1
          : targetLayout.y + targetLayout.height - 1;
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
      nativeIndicatorOpacity.value = 1;
    }
  };

  const startNativeDrag = (
    taskId: string,
    absoluteY: number,
    localY: number
  ) => {
    if (openMetadataTaskIds.size > 0) return;
    const layout = nativeLayouts.current.get(taskId);
    if (!layout) return;
    nativeDrag.current = {
      taskId,
      listTop: absoluteY - localY - layout.y,
      startScrollOffset: screenDragController.getScrollOffset(),
      insertionIndex: tasks.findIndex((task) => task.id === taskId),
      targetKey: null,
    };
    setDraggingId(taskId);
    hapticReorderPickup();
    moveNativeDrag(absoluteY, false);
  };

  const clearNativeDrag = () => {
    nativeDrag.current = null;
    setDraggingId(null);
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
    nativeIndicatorOpacity.value = 0;
  };

  const endNativeDrag = (absoluteY: number) => {
    const drag = nativeDrag.current;
    if (!drag) return;
    moveNativeDrag(absoluteY);
    reorderAt(drag.taskId, drag.insertionIndex);
    hapticReorderDrop();
    clearNativeDrag();
  };

  const startPointerDrag = (
    event: React.PointerEvent<HTMLElement>,
    taskId: string
  ) => {
    if (event.button !== 0 || openMetadataTaskIds.size > 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const drag: PointerDrag = {
      taskId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      sourceElement: event.currentTarget,
      ghost: null,
      line: null,
      insertionIndex: null,
      markerTaskId: null,
      markerEdge: null,
      moveListener: null,
      endListener: null,
      cancelListener: null,
    };
    drag.moveListener = (pointerEvent) => movePointerDrag(pointerEvent);
    drag.endListener = (pointerEvent) => endPointerDrag(pointerEvent);
    drag.cancelListener = (pointerEvent) => {
      if (pointerDrag.current?.pointerId === pointerEvent.pointerId) clearDragVisuals();
    };
    pointerDrag.current = drag;
    window.addEventListener('pointermove', drag.moveListener, { passive: false });
    window.addEventListener('pointerup', drag.endListener);
    window.addEventListener('pointercancel', drag.cancelListener);
  };

  const movePointerDrag = (event: {
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
      ghost.removeAttribute('data-task-row');
      Object.assign(ghost.style, {
        position: 'fixed',
        left: `${event.clientX - drag.offsetX}px`,
        top: `${event.clientY - drag.offsetY}px`,
        width: `${bounds.width}px`,
        opacity: '0.65',
        pointerEvents: 'none',
        zIndex: '9999',
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
      });
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      drag.sourceElement.setPointerCapture(event.pointerId);
      setDraggingId(drag.taskId);
    }

    event.preventDefault();
    drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
    drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;

    const tableElement = drag.sourceElement.parentElement;
    const allRows = Array.from(
      tableElement?.querySelectorAll<HTMLElement>('[data-task-row="true"]') ?? []
    );
    const sourceRow = allRows.find((row) => row.dataset.taskId === drag.taskId);
    const rows = allRows.filter((row) => row.dataset.taskId !== drag.taskId);
    const sourceIndex = tasks.findIndex((task) => task.id === drag.taskId);
    const previousRow =
      sourceIndex > 0
        ? allRows.find((row) => row.dataset.taskId === tasks[sourceIndex - 1]?.id)
        : undefined;
    let insertionIndex = rows.length;
    let marker:
      | { taskId: string; edge: 'before' | 'after'; insertionIndex: number }
      | null =
      rows.length > 0
        ? {
            taskId: rows[rows.length - 1].dataset.taskId!,
            edge: 'after',
            insertionIndex,
          }
        : null;
    const sourceBounds = sourceRow?.getBoundingClientRect();
    const previousBounds = previousRow?.getBoundingClientRect();
    if (
      sourceRow &&
      sourceBounds &&
      sourceIndex === tasks.length - 1 &&
      event.clientY > sourceBounds.bottom
    ) {
      insertionIndex = sourceIndex;
      marker = {
        taskId: drag.taskId,
        edge: 'after',
        insertionIndex,
      };
    } else if (
      sourceRow &&
      sourceBounds &&
      sourceIndex === 0 &&
      event.clientY < sourceBounds.top
    ) {
      insertionIndex = sourceIndex;
      marker = {
        taskId: drag.taskId,
        edge: 'before',
        insertionIndex,
      };
    } else if (
      sourceRow &&
      sourceBounds &&
      previousBounds &&
      event.clientY >= previousBounds.top + previousBounds.height / 2 &&
      event.clientY < sourceBounds.top
    ) {
      insertionIndex = sourceIndex;
      marker = {
        taskId: drag.taskId,
        edge: 'before',
        insertionIndex,
      };
    } else if (
      sourceRow &&
      sourceBounds &&
      event.clientY >= sourceBounds.top &&
      event.clientY <= sourceBounds.bottom
    ) {
      insertionIndex = sourceIndex;
      marker = {
        taskId: drag.taskId,
        edge: event.clientY < sourceBounds.top + sourceBounds.height / 2 ? 'before' : 'after',
        insertionIndex,
      };
    } else {
      for (let index = 0; index < rows.length; index += 1) {
        const bounds = rows[index].getBoundingClientRect();
        if (event.clientY < bounds.top + bounds.height / 2) {
          insertionIndex = index;
          marker = {
            taskId: rows[index].dataset.taskId!,
            edge: 'before',
            insertionIndex,
          };
          break;
        }
      }
    }
    drag.insertionIndex = marker?.insertionIndex ?? null;
    if (marker) {
      drag.markerTaskId = marker.taskId;
      drag.markerEdge = marker.edge;
      const line = drag.line ?? document.createElement('div');
      line.className =
        'pointer-events-none fixed z-[9998] h-0.5 bg-primary';
      drag.line = line;
      const target = allRows.find((row) => row.dataset.taskId === marker.taskId);
      if (target) {
        const bounds = target.getBoundingClientRect();
        Object.assign(line.style, {
          left: `${bounds.left}px`,
          top: `${marker.edge === 'before' ? bounds.top - 1 : bounds.bottom - 1}px`,
          width: `${bounds.width}px`,
        });
        if (!line.isConnected) document.body.appendChild(line);
      }
    }
  };

  const endPointerDrag = (event: {
    pointerId: number;
    preventDefault: () => void;
  }) => {
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
      if (drag.insertionIndex !== null) reorderAt(drag.taskId, drag.insertionIndex);
    }
    clearDragVisuals();
  };

  return (
    <View className="relative w-full overflow-visible">
      <ScrollView
        horizontal
        className="w-full max-w-full"
        scrollEnabled={!screenDragActive}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: '100%', minWidth: TASK_TABLE_MIN_WIDTH }}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onScroll={(event) => {
          horizontalScrollX.value = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        style={
          Platform.OS === 'web' && viewportWidth >= TASK_TABLE_MIN_WIDTH
            ? { overflow: 'visible' }
            : undefined
        }
      >
        <View
          className="relative overflow-visible rounded-md"
          style={{ width: '100%', minWidth: TASK_TABLE_MIN_WIDTH }}
          onLayout={(event) => {
            if (Platform.OS !== 'web') {
              setNativeTableWidth(event.nativeEvent.layout.width);
            }
          }}
        >
        {Platform.OS !== 'web' ? (
          <Animated.View
            pointerEvents="none"
            className="absolute left-0 right-0 z-30 h-0.5 bg-primary"
            style={nativeIndicatorStyle}
          />
        ) : null}
        <View className="h-10 flex-row items-center rounded-t-md bg-muted/60">
          <View className={cn(TASK_TABLE_COLUMNS.task, 'px-3')}>
            <Text variant="label" className="text-muted-foreground">Task</Text>
          </View>
          <View className={cn(TASK_TABLE_COLUMNS.status, 'px-2')}>
            <Text variant="label" className="ml-1 text-muted-foreground">Status</Text>
          </View>
          <View className={cn(TASK_TABLE_COLUMNS.assignees, 'px-2')}>
            <Text variant="label" className="ml-1 text-muted-foreground">Assignees</Text>
          </View>
          <View className={cn(TASK_TABLE_COLUMNS.dueDate, 'px-2')}>
            <Text variant="label" className="ml-1 text-muted-foreground">Due date</Text>
          </View>
          <View className={cn(TASK_TABLE_COLUMNS.priority, 'px-2')}>
            <Text variant="label" className="ml-1 text-muted-foreground">Priority</Text>
          </View>
          <View className={cn(TASK_TABLE_COLUMNS.tags, 'px-2')}>
            <Text variant="label" className="ml-1 text-muted-foreground">Tags</Text>
          </View>
          <View className={TASK_TABLE_COLUMNS.actions} />
        </View>

        {tasks.map((task, index) => {
          const webDragProps =
            Platform.OS === 'web'
              ? {
                  'data-task-row': 'true',
                  'data-task-index': index,
                  onPointerDown: (event: React.PointerEvent<HTMLElement>) =>
                    startPointerDrag(event, task.id),
                  onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
                    if (!suppressNextClick.current) return;
                    suppressNextClick.current = false;
                    event.preventDefault();
                    event.stopPropagation();
                  },
                }
              : {};

          return (
            <React.Fragment key={task.id}>
              {Platform.OS === 'web' ? (
                React.createElement(
                  'div',
                  {
                    ...webDragProps,
                    'data-task-id': task.id,
                    className: cn(
                      'relative',
                      draggingId === task.id && 'cursor-grabbing opacity-40'
                    ),
                  },
                  <TaskTableRow
                  task={task}
                  profiles={profiles}
                  highlighted={task.id === focusTaskId}
                  onOpen={() => onOpenTask(task)}
                  onMetadataOpenChange={(open) => {
                    setOpenMetadataTaskIds((current) => {
                      const next = new Set(current);
                      if (open) next.add(task.id);
                      else next.delete(task.id);
                      return next;
                    });
                  }}
                />
                )
              ) : (
                <View
                  className="relative"
                  style={
                    draggingId === task.id
                      ? { zIndex: 100, elevation: 100 }
                      : undefined
                  }
                  onLayout={(event) => {
                    const { y, height } = event.nativeEvent.layout;
                    nativeLayouts.current.set(task.id, { y, height });
                    setNativeLineLayouts((current) => {
                      const existing = current[task.id];
                      if (existing?.y === y && existing.height === height) {
                        return current;
                      }
                      return { ...current, [task.id]: { y, height } };
                    });
                  }}
                >
                  <MobileDragSurface
                    disabled={openMetadataTaskIds.size > 0}
                    onStart={(absoluteY, localY) =>
                      startNativeDrag(task.id, absoluteY, localY)
                    }
                    onMove={moveNativeDrag}
                    onEnd={endNativeDrag}
                    onCancel={clearNativeDrag}
                  >
                    <TaskTableRow
                      task={task}
                      profiles={profiles}
                      highlighted={task.id === focusTaskId}
                      onOpen={() => onOpenTask(task)}
                      onMetadataOpenChange={(open) => {
                        setOpenMetadataTaskIds((current) => {
                          const next = new Set(current);
                          if (open) next.add(task.id);
                          else next.delete(task.id);
                          return next;
                        });
                      }}
                    />
                  </MobileDragSurface>
                </View>
              )}
            </React.Fragment>
          );
        })}
          <View
            pointerEvents="none"
            className="absolute inset-0 z-20 rounded-md border border-border"
            style={
              TABLE_BORDER_RIGHT_OUTSET
                ? ({
                    borderRightWidth: 0,
                    boxShadow: `${TABLE_BORDER_RIGHT_OUTSET}px 0 0 hsl(var(--border))`,
                  } as any)
                : undefined
            }
          />
        </View>
      </ScrollView>
      {Platform.OS !== 'web'
        ? tasks.map((task) => (
            <NativeCompletedTaskLine
              key={task.id}
              completed={task.status === 'done'}
              layout={nativeLineLayouts[task.id]}
              tableWidth={nativeTableWidth}
              scrollX={horizontalScrollX}
            />
          ))
        : null}
    </View>
  );
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { projectId, task: focusParam } = useLocalSearchParams<{
    projectId: string;
    task?: string;
  }>();
  const { data, isLoading } = useProject(projectId);
  const { data: profiles } = useProfiles();
  const createTask = useCreateTask();
  const reorderTasks = useReorderTasks();
  const updateProject = useUpdateProject();
  const trashProject = useTrashProject();

  const addTask = async () => {
    await createTask.mutateAsync({
      project_id: projectId,
      projectName: data?.project?.name ?? 'Project',
      title: 'New task',
      notes: null,
      status: 'todo',
      assignee_ids: [],
      blocked_by: null,
      blocked_by_project: null,
      due_date: null,
      priority: 'medium',
      tags: [],
      sort_order: nextTaskSortOrder(data?.tasks ?? []),
    });
  };

  // Deep-linked task (?task=<id> from a notification tap): highlight its row,
  // let the emphasis fade after a few seconds. Render-time adjustment keeps
  // the param → state sync out of effects.
  const [prevFocusParam, setPrevFocusParam] = React.useState(focusParam);
  const [focusTaskId, setFocusTaskId] = React.useState<string | null>(focusParam ?? null);
  if (prevFocusParam !== focusParam) {
    setPrevFocusParam(focusParam);
    setFocusTaskId(focusParam ?? null);
  }
  React.useEffect(() => {
    if (!focusTaskId) return;
    const t = setTimeout(() => setFocusTaskId(null), 6000);
    return () => clearTimeout(t);
  }, [focusTaskId]);
  const [fAssignee, setFAssignee] = React.useState<string>('any');
  const [fPriority, setFPriority] = React.useState<string>('any');
  const [fTag, setFTag] = React.useState<string>('any');
  const [draftProjectId, setDraftProjectId] = React.useState<string | null>(null);
  const [nameDraft, setNameDraft] = React.useState('');
  const [descriptionDraft, setDescriptionDraft] = React.useState('');
  const nameSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const descriptionSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
      if (descriptionSaveTimer.current) clearTimeout(descriptionSaveTimer.current);
    },
    []
  );

  const project = data?.project;
  if (project && draftProjectId !== project.id) {
    setDraftProjectId(project.id);
    setNameDraft(project.name);
    setDescriptionDraft(project.description ?? '');
  }

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Project" backHref="/projects" />
        <View className="py-12">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!project) {
    return (
      <Screen>
        <ScreenHeader title="Project" backHref="/projects" />
        <EmptyState icon={FolderX} title="Project not found" description="This project may have been removed." />
      </Screen>
    );
  }

  const allProfiles = profiles ?? [];
  const members = allProfiles.filter((p) => p.status === 'approved');
  const tasks = data?.tasks ?? [];
  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags)));

  const filtered = tasks.filter((t) => {
    if (fAssignee === 'unassigned' && t.assignee_ids.length > 0) return false;
    if (fAssignee !== 'any' && fAssignee !== 'unassigned' && !t.assignee_ids.includes(fAssignee)) return false;
    if (fPriority !== 'any' && t.priority !== fPriority) return false;
    if (fTag !== 'any' && !t.tags.includes(fTag)) return false;
    return true;
  });
  const reorderVisibleTasks = (visibleTaskIds: string[]) => {
    const visibleIds = new Set(visibleTaskIds);
    let visibleIndex = 0;
    const taskIds = tasks.map((task) =>
      visibleIds.has(task.id) ? visibleTaskIds[visibleIndex++] : task.id
    );
    reorderTasks.mutate({ projectId: project.id, taskIds });
  };

  const assigneeFilterOptions = [
    { value: 'any', label: 'Anyone' },
    { value: 'unassigned', label: 'Unassigned' },
    ...members.map((m) => ({ value: m.id, label: m.full_name ?? 'Member' })),
  ];
  const priorityFilterOptions = [{ value: 'any', label: 'Any priority' }, ...PRIORITIES];
  const tagFilterOptions = [{ value: 'any', label: 'All tags' }, ...allTags.map((t) => ({ value: t, label: t }))];
  const commitName = (value: string) => {
    const name = value.trim();
    if (name && name !== project.name) updateProject.mutate({ id: project.id, name });
  };
  const commitDescription = (value: string) => {
    const description = value.trim() || null;
    if (description !== project.description) updateProject.mutate({ id: project.id, description });
  };
  const changeName = (value: string) => {
    setNameDraft(value);
    if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
    const name = value.trim();
    if (!name || name === project.name) {
      nameSaveTimer.current = null;
      return;
    }
    nameSaveTimer.current = setTimeout(() => {
      nameSaveTimer.current = null;
      commitName(value);
    }, 600);
  };
  const changeDescription = (value: string) => {
    setDescriptionDraft(value);
    if (descriptionSaveTimer.current) clearTimeout(descriptionSaveTimer.current);
    const description = value.trim() || null;
    if (description === project.description) {
      descriptionSaveTimer.current = null;
      return;
    }
    descriptionSaveTimer.current = setTimeout(() => {
      descriptionSaveTimer.current = null;
      commitDescription(value);
    }, 600);
  };
  const finishNameEditing = () => {
    if (nameSaveTimer.current) {
      clearTimeout(nameSaveTimer.current);
      nameSaveTimer.current = null;
      commitName(nameDraft);
    }
    if (!nameDraft.trim()) setNameDraft(project.name);
  };
  const finishDescriptionEditing = () => {
    if (descriptionSaveTimer.current) {
      clearTimeout(descriptionSaveTimer.current);
      descriptionSaveTimer.current = null;
      commitDescription(descriptionDraft);
    }
  };

  return (
    <Screen contentClassName="gap-7">
      <View className="gap-2">
        <Pressable
          className="-ml-1 flex-row items-center gap-1 self-start py-1 active:opacity-70"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/projects');
            }
          }}
        >
          <Icon as={ChevronLeft} size={18} className="text-muted-foreground" />
          <Text variant="muted">Back</Text>
        </Pressable>

        <View className="flex-row items-start justify-between gap-4">
          <View className="min-w-0 flex-1 gap-2">
            <AutoGrowingTextInput
              minHeight={32}
              value={nameDraft}
              onChangeText={changeName}
              onBlur={finishNameEditing}
              onSubmitEditing={finishNameEditing}
              className="min-h-8 rounded-none border-0 bg-transparent px-0 py-0 text-2xl font-bold tracking-tight outline-none focus:border-transparent"
            />

            <View className="min-h-8 pt-1.5">
              <AutoGrowingTextInput
                minHeight={20}
                value={descriptionDraft}
                onChangeText={changeDescription}
                onBlur={finishDescriptionEditing}
                onSubmitEditing={finishDescriptionEditing}
                placeholder="Add a description"
                placeholderTextColor={
                  colorScheme === 'dark' ? 'hsl(0 0% 68%)' : 'hsl(0 0% 36%)'
                }
                className="min-h-5 max-w-full rounded-none border-0 bg-transparent p-0 text-sm outline-none focus:border-transparent"
              />
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              label="Trash"
              accessibilityLabel="View recently deleted tasks"
              onPress={() => router.push(`/projects/${project.id}/trash` as any)}
            />
            <DeleteButton
              variant="outline"
              size="sm"
              className="w-9 px-0"
              icon={Trash2}
              accessibilityLabel="Move project to trash"
              onPress={() => {
                trashProject.mutate(project.id);
                router.replace('/projects' as any);
              }}
            />
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-x-10 gap-y-6">
        <View className="w-full flex-none gap-2 sm:w-52">
          <View className="flex-row items-center gap-2">
            <Icon as={CircleDot} size={16} className="text-muted-foreground" />
            <Text variant="muted">Status</Text>
          </View>
          <Select
            options={PROJECT_STATUSES}
            value={project.status}
            onChange={(status) => updateProject.mutate({ id: project.id, status })}
            renderValue={(option) => (
              <Badge variant={projectStatusVariant(option.value)} label={option.label} />
            )}
            className="h-10 rounded-md border-transparent bg-transparent px-2 hover:bg-accent"
          />
        </View>

        <View className="w-full flex-none gap-2 sm:w-52">
          <View className="flex-row items-center gap-2">
            <Icon as={Flag} size={16} className="text-muted-foreground" />
            <Text variant="muted">Priority</Text>
          </View>
          <Select
            options={PRIORITIES}
            value={project.priority}
            onChange={(priority) => updateProject.mutate({ id: project.id, priority })}
            renderValue={(option) => (
              <Badge variant={priorityVariant(option.value)} label={option.label} />
            )}
            className="h-10 rounded-md border-transparent bg-transparent px-2 hover:bg-accent"
          />
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text variant="title">Tasks ({tasks.length})</Text>
        <View className="flex-row items-center gap-2">
          {tasks.length > 0 ? (
            <FilterMenu
              groups={[
                { key: 'assignee', label: 'Assignee', value: fAssignee, options: assigneeFilterOptions, onChange: setFAssignee },
                { key: 'priority', label: 'Priority', value: fPriority, options: priorityFilterOptions, onChange: setFPriority },
                ...(allTags.length > 0
                  ? [{ key: 'tag', label: 'Tag', value: fTag, options: tagFilterOptions, onChange: setFTag }]
                  : []),
              ]}
            />
          ) : null}
          <Button
            size="sm"
            label="Add task"
            icon={Plus}
            loading={createTask.isPending}
            disabled={createTask.isPending}
            onPress={addTask}
          />
        </View>
      </View>

      {tasks.length === 0 ? (
        <EmptyState icon={Plus} title="No tasks yet" description="Add the first task to get this project moving." />
      ) : (
        <TaskTable
          tasks={filtered}
          profiles={members}
          focusTaskId={focusTaskId}
          onReorder={reorderVisibleTasks}
          onOpenTask={(task) =>
            router.push(`/projects/${task.project_id}/${task.id}` as any)
          }
        />
      )}
    </Screen>
  );
}
