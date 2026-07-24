import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarDays,
  ChevronLeft,
  CircleDot,
  Eye,
  ExternalLink,
  FileX,
  Flag,
  FolderKanban,
  Pencil,
  Tag,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Markdown } from '@/components/ui/markdown';
import { MultiSelect, Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  useAllTasks,
  useDeleteTask,
  useProject,
  useProjects,
  useUpdateTask,
} from '@/lib/queries/tasks';
import { useProfiles } from '@/lib/queries/profiles';
import { PRIORITIES, TASK_STATUSES, type Profile, type TaskStatus } from '@/lib/types';
import { priorityVariant, taskStatusVariant } from '@/lib/task-style';
import { cn } from '@/lib/utils';

function TaskField({
  icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="w-full flex-none gap-2 sm:w-52">
      <View className="flex-row items-center gap-2">
        <Icon as={icon} size={16} className="text-muted-foreground" />
        <Text variant="muted">{label}</Text>
      </View>
      <View className="min-h-7 justify-center">{children}</View>
    </View>
  );
}

function AssigneeDropdown({
  members,
  values,
  onChange,
}: {
  members: Profile[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const options = members.map((member) => ({
    value: member.id,
    label: member.full_name ?? 'Member',
  }));

  return (
    <MultiSelect
      options={options}
      values={values}
      onChange={onChange}
      placeholder="Unassigned"
      className="h-auto min-h-10 rounded-md border-transparent bg-transparent px-2 py-1.5"
      renderValue={(selectedOptions) => (
        <View className="flex-row flex-wrap gap-2">
          {selectedOptions.map((option) => {
            const member = members.find((item) => item.id === option.value);
            return (
              <View key={option.value} className="max-w-full flex-row items-center gap-1.5">
                <Avatar name={member?.full_name} uri={member?.avatar_url} size={24} />
                <Text variant="small" className="shrink">
                  {option.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      renderOption={(option) => {
        const member = members.find((item) => item.id === option.value);
        return (
          <View className="flex-row items-center gap-2">
            <Avatar name={member?.full_name} uri={member?.avatar_url} size={24} />
            <Text className="text-sm font-medium">{option.label}</Text>
          </View>
        );
      }}
      renderSelectedOption={(option) => {
        const member = members.find((item) => item.id === option.value);
        return (
          <View className="flex-row items-center gap-1.5">
            <Avatar name={member?.full_name} uri={member?.avatar_url} size={20} />
            <Text className="text-sm font-medium">{option.label}</Text>
          </View>
        );
      }}
    />
  );
}

export default function TaskNotesScreen() {
  const router = useRouter();
  const { projectId, taskId } = useLocalSearchParams<{ projectId: string; taskId: string }>();
  const { data, isLoading } = useProject(projectId);
  const { data: profiles } = useProfiles();
  const { data: allTasks } = useAllTasks();
  const { data: projects } = useProjects();
  const update = useUpdateTask();
  const deleteTask = useDeleteTask();
  const task = data?.tasks.find((t) => t.id === taskId);

  // Seed the draft once the task arrives; the page always opens in preview.
  const [loadedId, setLoadedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [titleDraft, setTitleDraft] = React.useState('');
  const [tagsDraft, setTagsDraft] = React.useState('');
  const [blockerError, setBlockerError] = React.useState<string | null>(null);
  const [projectHovered, setProjectHovered] = React.useState(false);
  const [tagsHovered, setTagsHovered] = React.useState(false);
  const titleSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    },
    []
  );
  if (task && loadedId !== task.id) {
    setLoadedId(task.id);
    setDraft(task.notes ?? '');
    setEditing(false);
    setEditingField(null);
    setTitleDraft(task.title);
    setTagsDraft(task.tags.join(', '));
  }

  const backHref = `/tasks/${projectId}`;

  if (isLoading) {
    return (
      <Screen maxWidth="max-w-3xl">
        <ScreenHeader title="Notes" backHref={backHref} />
        <View className="py-12">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!task) {
    return (
      <Screen maxWidth="max-w-3xl">
        <ScreenHeader title="Notes" backHref={backHref} />
        <EmptyState icon={FileX} title="Task not found" description="It may have been completed or deleted." />
      </Screen>
    );
  }

  const project = data?.project;
  const members = (profiles ?? []).filter((profile) => profile.status === 'approved');
  const taskBlockerOptions = (allTasks ?? [])
    .filter((candidate) => candidate.id !== task.id)
    .map((candidate) => ({
      value: `task:${candidate.id}`,
      label: `Task: ${candidate.title} - ${candidate.project?.name ?? 'Project'}`,
    }));
  const projectBlockerOptions = (projects ?? []).map((candidate) => ({
    value: `project:${candidate.id}`,
    label: `Project: ${candidate.name}`,
  }));
  const blockedByTask = (allTasks ?? []).find((candidate) => candidate.id === task.blocked_by);
  const blockedByProject = (projects ?? []).find(
    (candidate) => candidate.id === task.blocked_by_project
  );
  const blockerValue = task.blocked_by
    ? `task:${task.blocked_by}`
    : task.blocked_by_project
      ? `project:${task.blocked_by_project}`
      : 'none';

  const commitTitle = (value: string) => {
    const title = value.trim();
    if (title && title !== task.title) update.mutate({ id: task.id, title });
  };
  const changeTitle = (value: string) => {
    setTitleDraft(value);
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    const title = value.trim();
    if (!title || title === task.title) {
      titleSaveTimer.current = null;
      return;
    }
    titleSaveTimer.current = setTimeout(() => {
      titleSaveTimer.current = null;
      commitTitle(value);
    }, 600);
  };
  const finishTitleEditing = () => {
    if (titleSaveTimer.current) {
      clearTimeout(titleSaveTimer.current);
      titleSaveTimer.current = null;
      commitTitle(titleDraft);
    }
    if (!titleDraft.trim()) setTitleDraft(task.title);
  };
  const commitNotes = (value: string) => {
    const notes = value.trim() || null;
    if (notes !== task.notes) update.mutate({ id: task.id, notes });
  };
  const changeNotes = (value: string) => {
    setDraft(value);
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    const notes = value.trim() || null;
    if (notes === task.notes) {
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
  const toggleNotesMode = () => {
    if (editing) flushNotes();
    setEditing((value) => !value);
  };
  const saveTags = () => {
    const tags = Array.from(
      new Set(
        tagsDraft
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
      )
    );
    update.mutate({ id: task.id, tags });
    setEditingField(null);
  };

  return (
    <Screen maxWidth="max-w-6xl" contentClassName="gap-7">
      <View className="gap-2">
        <Pressable
          className="-ml-1 flex-row items-center gap-1 self-start py-1 active:opacity-70"
          onPress={() => router.back()}
        >
          <Icon as={ChevronLeft} size={18} className="text-muted-foreground" />
          <Text variant="muted">Back</Text>
        </Pressable>
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Input
              value={titleDraft}
              onChangeText={changeTitle}
              onBlur={finishTitleEditing}
              onSubmitEditing={finishTitleEditing}
              className="h-auto min-h-8 rounded-none border-0 bg-transparent px-0 py-0 text-2xl font-bold tracking-tight outline-none focus:border-transparent"
            />
          </View>
          <DeleteButton
            variant="outline"
            size="icon"
            icon={Trash2}
            accessibilityLabel="Delete task"
            disabled={deleteTask.isPending}
            onPress={() => {
              deleteTask.mutate(task.id);
              router.replace(backHref as any);
            }}
          />
        </View>
      </View>

      <View className="flex-row flex-wrap gap-x-10 gap-y-6">
        <TaskField icon={Users} label="Assignees">
          <AssigneeDropdown
            members={members}
            values={task.assignee_ids}
            onChange={(assignee_ids) => update.mutate({ id: task.id, assignee_ids })}
          />
        </TaskField>

        <TaskField icon={CircleDot} label="Status">
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
            className="h-10 rounded-md border-transparent bg-transparent px-2 hover:bg-accent"
          />

          {task.status === 'blocked' ? (
            <View className="mt-3 gap-2 border-l-2 border-border pl-3">
              <Text variant="small">Blocked by</Text>
              <View className="flex-row items-center gap-1">
                <View className="flex-1">
                  <Select
                    options={[
                      { value: 'none', label: 'Nothing' },
                      ...projectBlockerOptions,
                      ...taskBlockerOptions,
                    ]}
                    value={blockerValue}
                    onChange={(blocker) => {
                      setBlockerError(null);
                      update.mutate({
                        id: task.id,
                        blocked_by: blocker.startsWith('task:') ? blocker.slice(5) : null,
                        blocked_by_project: blocker.startsWith('project:')
                          ? blocker.slice(8)
                          : null,
                      }, {
                        onError: (error) => {
                          const missingColumn = error.message.includes('blocked_by_project');
                          setBlockerError(
                            missingColumn
                              ? 'Project blockers require database migration 0014.'
                              : error.message || 'Could not update the blocker.'
                          );
                        },
                      });
                    }}
                    className="h-10 rounded-md border-transparent bg-transparent px-2 hover:bg-accent"
                  />
                </View>
                {blockedByTask ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={ExternalLink}
                    accessibilityLabel={`Open ${blockedByTask.title}`}
                    onPress={() =>
                      router.push(`/tasks/${blockedByTask.project_id}/${blockedByTask.id}` as any)
                    }
                  />
                ) : blockedByProject ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={ExternalLink}
                    accessibilityLabel={`Open ${blockedByProject.name}`}
                    onPress={() => router.push(`/tasks/${blockedByProject.id}` as any)}
                  />
                ) : null}
              </View>
              {blockerError ? (
                <Text variant="small" className="text-destructive">
                  {blockerError}
                </Text>
              ) : null}
            </View>
          ) : null}
        </TaskField>

        <TaskField icon={CalendarDays} label="Due">
          <DatePicker
            value={task.due_date}
            onChange={(due_date) => update.mutate({ id: task.id, due_date })}
            className="border-transparent bg-transparent px-2 hover:bg-accent"
          />
        </TaskField>

        <TaskField icon={FolderKanban} label="Project">
          <Pressable
            onHoverIn={() => setProjectHovered(true)}
            onHoverOut={() => setProjectHovered(false)}
            className={cn(
              'min-h-10 w-full justify-center rounded-md px-2 active:bg-accent',
              projectHovered && 'bg-accent'
            )}
            onPress={() => router.push(backHref as any)}
          >
            <Text className="text-sm font-medium">{project?.name ?? 'Project'}</Text>
          </Pressable>
        </TaskField>

        <TaskField icon={Flag} label="Priority">
          <Select
            options={PRIORITIES}
            value={task.priority}
            onChange={(priority) => update.mutate({ id: task.id, priority })}
            renderValue={(option) => (
              <Badge variant={priorityVariant(option.value)} label={option.label} />
            )}
            className="h-10 rounded-md border-transparent bg-transparent px-2 hover:bg-accent"
          />
        </TaskField>

        <TaskField icon={Tag} label="Tags">
          {editingField === 'tags' ? (
            <Input
              autoFocus
              value={tagsDraft}
              onChangeText={setTagsDraft}
              onBlur={saveTags}
              onSubmitEditing={saveTags}
              placeholder="Comma-separated tags"
              autoCapitalize="none"
              className="h-10 rounded-md border-transparent bg-transparent px-2 outline-none focus:border-transparent"
            />
          ) : (
            <Pressable
              onHoverIn={() => setTagsHovered(true)}
              onHoverOut={() => setTagsHovered(false)}
              className={cn(
                'min-h-10 w-full justify-center rounded-md px-2 active:bg-accent',
                tagsHovered && 'bg-accent'
              )}
              onPress={() => {
                setTagsDraft(task.tags.join(', '));
                setEditingField('tags');
              }}
            >
              {task.tags.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {task.tags.map((tag) => <Badge key={tag} variant="secondary" label={tag} />)}
                </View>
              ) : (
                <Text variant="muted">No tags</Text>
              )}
            </Pressable>
          )}
        </TaskField>
      </View>

      <View className="gap-2">
        <View className="flex-row justify-end">
          <Button
            variant="outline"
            size="sm"
            label={editing ? 'Preview' : 'Edit'}
            icon={editing ? Eye : Pencil}
            onPress={toggleNotesMode}
          />
        </View>
        <View className="min-h-[420px] border-t border-border pt-4">
          {editing ? (
            <Textarea
              autoFocus
              value={draft}
              onChangeText={changeNotes}
              onBlur={flushNotes}
              placeholder={'# Heading\n\nWrite anything - **bold**, lists, `code`, [links](https://example.com).'}
              className="min-h-[380px] resize-none rounded-none border-0 bg-transparent p-0 text-base outline-none focus:border-transparent"
            />
          ) : draft ? (
            <View className="min-h-[320px]">
              <Markdown value={draft} />
            </View>
          ) : (
            <View className="min-h-[280px]">
              <Text variant="muted">No notes yet. Switch to Edit to add them.</Text>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}
