import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
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
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { OptionChips } from '@/components/ui/option-chips';
import { MultiSelect, Select } from '@/components/ui/select';
import { FadeModal, FADE_DURATION_MS } from '@/components/ui/fade-modal';
import { cn } from '@/lib/utils';
import { useProfiles } from '@/lib/queries/profiles';
import {
  useProject,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useUpdateProject,
  useTrashProject,
} from '@/lib/queries/tasks';
import { priorityVariant, labelOf } from '@/lib/task-style';
import {
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  type Priority,
  type Profile,
  type Task,
  type TaskStatus,
} from '@/lib/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const [dueDate, setDueDate] = React.useState(initial?.due_date ?? '');
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

  /** Saves, then hands back a task id when the notes page should open next. */
  const onSave = async (openNotes = false) => {
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
      due_date: dueDate.trim() || null,
      tags,
    };
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...fields });
      onDone(openNotes ? initial.id : undefined);
    } else {
      onDone(await create.mutateAsync({ project_id: projectId, projectName, notes: null, ...fields }));
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
  const openNotes = () => router.push(`/tasks/${task.project_id}/${task.id}` as any);
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
              update.mutate({ id: task.id, status: s, blocked_by: s === 'blocked' ? task.blocked_by : null })
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

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { projectId, task: focusParam } = useLocalSearchParams<{
    projectId: string;
    task?: string;
  }>();
  const { data, isLoading } = useProject(projectId);
  const { data: profiles } = useProfiles();
  const updateProject = useUpdateProject();
  const trashProject = useTrashProject();

  const [adding, setAdding] = React.useState(false);
  const [addMounted, setAddMounted] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const openAddTask = () => {
    setAddMounted(true);
    setAdding(true);
  };
  const closeAddTask = () => setAdding(false);

  // Deep-linked task (?task=<id> from a notification tap): highlight its card,
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

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Project" backHref="/tasks" />
        <View className="py-12">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  const project = data?.project;
  if (!project) {
    return (
      <Screen>
        <ScreenHeader title="Project" backHref="/tasks" />
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

  const assigneeFilterOptions = [
    { value: 'any', label: 'Anyone' },
    { value: 'unassigned', label: 'Unassigned' },
    ...members.map((m) => ({ value: m.id, label: m.full_name ?? 'Member' })),
  ];
  const priorityFilterOptions = [{ value: 'any', label: 'Any priority' }, ...PRIORITIES];
  const tagFilterOptions = [{ value: 'any', label: 'All tags' }, ...allTags.map((t) => ({ value: t, label: t }))];

  return (
    <Screen>
      <ScreenHeader title={project.name} description={project.description ?? undefined} backHref="/tasks">
        <DeleteButton
          variant="outline"
          size="icon"
          icon={Trash2}
          accessibilityLabel="Move project to trash"
          onPress={() => {
            trashProject.mutate(project.id);
            router.replace('/tasks' as any);
          }}
        />
      </ScreenHeader>

      <Card>
        <CardContent className="flex-row gap-2 p-4">
          <View className="flex-1 gap-1.5">
            <Text variant="label">Status</Text>
            <Select
              options={PROJECT_STATUSES}
              value={project.status}
              onChange={(s) => updateProject.mutate({ id: project.id, status: s })}
            />
          </View>
          <View className="flex-1 gap-1.5">
            <Text variant="label">Priority</Text>
            <Select
              options={PRIORITIES}
              value={project.priority}
              onChange={(p) => updateProject.mutate({ id: project.id, priority: p })}
            />
          </View>
        </CardContent>
      </Card>

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
          {editingId === null ? <Button size="sm" label="Add task" icon={Plus} onPress={openAddTask} /> : null}
        </View>
      </View>

      {addMounted ? (
        <ModalSheet
          visible={adding}
          onClose={closeAddTask}
          onDismiss={() => setAddMounted(false)}
        >
          <TaskEditor
            projectId={project.id}
            projectName={project.name}
            members={members}
            siblings={tasks}
            onDone={(createdId) => {
              closeAddTask();
              if (createdId) router.push(`/tasks/${project.id}/${createdId}` as any);
            }}
          />
        </ModalSheet>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState icon={Plus} title="No tasks yet" description="Add the first task to get this project moving." />
      ) : (
        TASK_STATUSES.map((s) => {
          const group = filtered.filter((t) => t.status === s.value);
          if (group.length === 0) return null;
          return (
            <View key={s.value} className="gap-2">
              <Text variant="label" className="text-muted-foreground">
                {s.label} ({group.length})
              </Text>
              {group.map((t) =>
                editingId === t.id ? (
                  <TaskEditor
                    key={t.id}
                    projectId={project.id}
                    projectName={project.name}
                    members={members}
                    siblings={tasks.filter((x) => x.id !== t.id)}
                    initial={t}
                    onDone={(openId) => {
                      setEditingId(null);
                      if (openId) router.push(`/tasks/${project.id}/${openId}` as any);
                    }}
                  />
                ) : (
                  <TaskCard
                    key={t.id}
                    task={t}
                    siblings={tasks.filter((x) => x.id !== t.id)}
                    profiles={allProfiles}
                    onEdit={() => setEditingId(t.id)}
                    highlighted={t.id === focusTaskId}
                  />
                )
              )}
            </View>
          );
        })
      )}
    </Screen>
  );
}
