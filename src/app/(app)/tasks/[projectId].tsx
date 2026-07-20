import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FolderX, Plus, Pencil, Trash2, Calendar, X, Tag } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { OptionChips } from '@/components/ui/option-chips';
import { useProfiles } from '@/lib/queries/profiles';
import {
  useProject,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useUpdateProject,
  useTrashProject,
  type TaskWithAssignee,
} from '@/lib/queries/tasks';
import { priorityVariant, projectStatusVariant, labelOf } from '@/lib/task-style';
import {
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  type Priority,
  type Profile,
  type TaskStatus,
} from '@/lib/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function TaskEditor({
  projectId,
  projectName,
  members,
  initial,
  onDone,
}: {
  projectId: string;
  projectName: string;
  members: Profile[];
  initial?: TaskWithAssignee;
  onDone: () => void;
}) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [status, setStatus] = React.useState<TaskStatus>(initial?.status ?? 'todo');
  const [priority, setPriority] = React.useState<Priority>(initial?.priority ?? 'medium');
  const [assigneeId, setAssigneeId] = React.useState<string | null>(initial?.assignee_id ?? null);
  const [dueDate, setDueDate] = React.useState(initial?.due_date ?? '');
  const [tags, setTags] = React.useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const assigneeOptions = [
    { value: 'none', label: 'Unassigned' },
    ...members.map((m) => ({ value: m.id, label: m.full_name ?? 'Member' })),
  ];

  const addTag = () => {
    const parts = tagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length) setTags((prev) => Array.from(new Set([...prev, ...parts])));
    setTagInput('');
  };

  const onSave = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (dueDate && !DATE_RE.test(dueDate.trim())) {
      setError('Due date must be YYYY-MM-DD.');
      return;
    }
    const due = dueDate.trim() || null;
    if (initial) {
      await update.mutateAsync({ id: initial.id, title: title.trim(), status, priority, assignee_id: assigneeId, due_date: due, tags });
    } else {
      await create.mutateAsync({
        project_id: projectId,
        projectName,
        title: title.trim(),
        status,
        priority,
        assignee_id: assigneeId,
        due_date: due,
        tags,
      });
    }
    onDone();
  };

  return (
    <Card className="border-primary/40">
      <CardContent className="gap-3 p-4">
        <Text variant="title">{initial ? 'Edit task' : 'New task'}</Text>
        <Input value={title} onChangeText={setTitle} placeholder="Task title" />

        <View className="gap-1.5">
          <Text variant="label">Status</Text>
          <OptionChips options={TASK_STATUSES} value={status} onChange={setStatus} />
        </View>
        <View className="gap-1.5">
          <Text variant="label">Priority</Text>
          <OptionChips options={PRIORITIES} value={priority} onChange={setPriority} />
        </View>
        <View className="gap-1.5">
          <Text variant="label">Assignee</Text>
          <OptionChips
            options={assigneeOptions}
            value={assigneeId ?? 'none'}
            onChange={(v) => setAssigneeId(v === 'none' ? null : v)}
          />
        </View>
        <View className="gap-1.5">
          <Text variant="label">Due date</Text>
          <Input value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
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
          <Button variant="ghost" label="Cancel" onPress={onDone} className="flex-1" />
          <Button label={initial ? 'Save' : 'Add task'} loading={busy} disabled={busy} onPress={onSave} className="flex-1" />
        </View>
      </CardContent>
    </Card>
  );
}

function TaskCard({
  task,
  projectName,
  members,
  onEdit,
  highlighted = false,
}: {
  task: TaskWithAssignee;
  projectName: string;
  members: Profile[];
  onEdit: () => void;
  highlighted?: boolean;
}) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  return (
    <Card className={highlighted ? 'border-primary' : undefined}>
      <CardContent className="gap-3 p-4">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 font-semibold">{task.title}</Text>
          <Badge variant={priorityVariant(task.priority)} label={labelOf(PRIORITIES, task.priority)} />
        </View>

        <View className="flex-row flex-wrap items-center gap-3">
          {task.assignee ? (
            <View className="flex-row items-center gap-1.5">
              <Avatar name={task.assignee.full_name} uri={task.assignee.avatar_url} size={20} />
              <Text variant="small">{task.assignee.full_name ?? 'Member'}</Text>
            </View>
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

        <OptionChips
          options={TASK_STATUSES}
          value={task.status}
          onChange={(s) => update.mutate({ id: task.id, status: s })}
        />

        <View className="flex-row gap-2">
          <Button variant="outline" size="sm" label="Edit" icon={Pencil} onPress={onEdit} className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            label="Delete"
            icon={Trash2}
            disabled={del.isPending}
            onPress={() => del.mutate(task.id)}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
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
  const [editingId, setEditingId] = React.useState<string | null>(null);

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

  const members = (profiles ?? []).filter((p) => p.status === 'approved');
  const tasks = data?.tasks ?? [];
  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags)));

  const filtered = tasks.filter((t) => {
    if (fAssignee === 'unassigned' && t.assignee_id) return false;
    if (fAssignee !== 'any' && fAssignee !== 'unassigned' && t.assignee_id !== fAssignee) return false;
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
        <Button
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
        <CardContent className="gap-3 p-4">
          <View className="flex-row flex-wrap gap-2">
            <Badge variant={projectStatusVariant(project.status)} label={labelOf(PROJECT_STATUSES, project.status)} />
            <Badge variant={priorityVariant(project.priority)} label={labelOf(PRIORITIES, project.priority)} />
          </View>
          <View className="gap-1.5">
            <Text variant="label">Status</Text>
            <OptionChips
              options={PROJECT_STATUSES}
              value={project.status}
              onChange={(s) => updateProject.mutate({ id: project.id, status: s })}
            />
          </View>
          <View className="gap-1.5">
            <Text variant="label">Priority</Text>
            <OptionChips
              options={PRIORITIES}
              value={project.priority}
              onChange={(p) => updateProject.mutate({ id: project.id, priority: p })}
            />
          </View>
        </CardContent>
      </Card>

      <View className="flex-row items-center justify-between">
        <Text variant="title">Tasks ({tasks.length})</Text>
        {!adding && editingId === null ? <Button size="sm" label="Add task" icon={Plus} onPress={() => setAdding(true)} /> : null}
      </View>

      {adding ? (
        <TaskEditor
          projectId={project.id}
          projectName={project.name}
          members={members}
          onDone={() => setAdding(false)}
        />
      ) : null}

      {tasks.length > 0 ? (
        <View className="gap-2">
          <OptionChips options={assigneeFilterOptions} value={fAssignee} onChange={setFAssignee} />
          <OptionChips options={priorityFilterOptions} value={fPriority} onChange={setFPriority} />
          {allTags.length > 0 ? <OptionChips options={tagFilterOptions} value={fTag} onChange={setFTag} /> : null}
        </View>
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
                    initial={t}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <TaskCard
                    key={t.id}
                    task={t}
                    projectName={project.name}
                    members={members}
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
