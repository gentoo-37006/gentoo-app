import * as React from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  Check,
  CircleDot,
  Eye,
  ExternalLink,
  FileX,
  Flag,
  FolderKanban,
  Pencil,
  Tag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Markdown } from '@/components/ui/markdown';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { FadeModal } from '@/components/ui/fade-modal';
import { useAllTasks, useProject, useProjects, useUpdateTask } from '@/lib/queries/tasks';
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
    <View className="min-w-40 flex-1 gap-2">
      <View className="flex-row items-center gap-2">
        <Icon as={icon} size={16} className="text-muted-foreground" />
        <Text variant="muted">{label}</Text>
      </View>
      <View className="min-h-7 justify-center">{children}</View>
    </View>
  );
}

type DropdownAnchor = { left: number; top: number; width: number; height: number };

function AssigneeDropdown({
  members,
  values,
  onChange,
}: {
  members: Profile[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<DropdownAnchor | null>(null);
  const triggerRef = React.useRef<View>(null);
  const selected = members.filter((member) => values.includes(member.id));
  const windowSize = Dimensions.get('window');
  const menuWidth = anchor
    ? Math.min(Math.max(anchor.width, 286), windowSize.width - 24)
    : 286;
  const menuLeft = anchor
    ? Math.min(Math.max(12, anchor.left), windowSize.width - menuWidth - 12)
    : 12;
  const menuTop = anchor
    ? anchor.top + anchor.height + 320 > windowSize.height
      ? Math.max(12, anchor.top - 304)
      : anchor.top + anchor.height + 4
    : 12;

  const openDropdown = () =>
    triggerRef.current?.measureInWindow((left, top, width, height) => {
      setAnchor({ left, top, width, height });
      setOpen(true);
    });

  const toggle = (id: string) =>
    onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);

  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable
        onPress={openDropdown}
        className="min-h-10 flex-row items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 active:bg-accent"
      >
        <View className="flex-1 flex-row flex-wrap gap-1.5">
          {selected.length > 0 ? (
            selected.map((member) => (
              <View
                key={member.id}
                className="flex-row items-center gap-1.5 rounded-sm bg-muted px-1.5 py-1"
              >
                <Avatar name={member.full_name} uri={member.avatar_url} size={22} />
                <Text className="text-sm font-medium">{member.full_name ?? 'Member'}</Text>
                <Icon as={X} size={13} className="text-muted-foreground" />
              </View>
            ))
          ) : (
            <Text variant="muted">Unassigned</Text>
          )}
        </View>
        <Icon as={ChevronDown} size={16} className="text-muted-foreground" />
      </Pressable>

      {anchor ? (
        <FadeModal
          visible={open}
          onRequestClose={() => setOpen(false)}
          onDismiss={() => setAnchor(null)}
        >
          <Pressable className="flex-1" onPress={() => setOpen(false)}>
            <View
              className="absolute overflow-hidden rounded-md border border-border bg-popover"
              style={{ left: menuLeft, top: menuTop, width: menuWidth }}
            >
              <View className="border-b border-border px-3 py-3">
                <Text className="text-sm text-muted-foreground">Select as many as you like</Text>
              </View>
              <ScrollView style={{ maxHeight: 250 }} contentContainerClassName="p-1.5">
                {members.map((member) => {
                  const active = values.includes(member.id);
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => toggle(member.id)}
                      className={cn(
                        'flex-row items-center gap-2.5 rounded-sm px-2 py-2',
                        active ? 'bg-accent' : 'active:bg-accent'
                      )}
                    >
                      <Avatar name={member.full_name} uri={member.avatar_url} size={24} />
                      <Text className="flex-1 text-sm font-medium">{member.full_name ?? 'Member'}</Text>
                      {active ? <Icon as={Check} size={16} className="text-primary" /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </FadeModal>
      ) : null}
    </View>
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
  const task = data?.tasks.find((t) => t.id === taskId);

  // Seed the draft once the task arrives; the page always opens in preview.
  const [loadedId, setLoadedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [titleDraft, setTitleDraft] = React.useState('');
  const [tagsDraft, setTagsDraft] = React.useState('');
  const [blockerError, setBlockerError] = React.useState<string | null>(null);
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

  const dirty = draft !== (task.notes ?? '');
  const save = () => update.mutate({ id: task.id, notes: draft.trim() || null });
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

  const saveTitle = () => {
    const title = titleDraft.trim();
    if (title && title !== task.title) update.mutate({ id: task.id, title });
    setEditingField(null);
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
    <Screen maxWidth="max-w-5xl" contentClassName="gap-7">
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
            {editingField === 'title' ? (
              <Input
                autoFocus
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={saveTitle}
                onSubmitEditing={saveTitle}
                className="h-12 px-0 text-2xl font-bold"
              />
            ) : (
              <Pressable
                className="self-start active:opacity-70"
                onPress={() => {
                  setTitleDraft(task.title);
                  setEditingField('title');
                }}
              >
                <Text variant="h2">{task.title}</Text>
              </Pressable>
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              label={editing ? 'Preview' : 'Edit notes'}
              icon={editing ? Eye : Pencil}
              onPress={() => setEditing((value) => !value)}
            />
            {editing ? (
              <Button
                size="sm"
                label="Save"
                loading={update.isPending}
                disabled={!dirty || update.isPending}
                onPress={save}
              />
            ) : null}
          </View>
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
            className="h-10 rounded-md"
          />

          {task.status === 'blocked' ? (
            <View className="mt-3 gap-2 border-l-2 border-border pl-3">
              <Text variant="small">Blocked by</Text>
              <View className="flex-row items-center gap-1">
                <View className="flex-1">
                  <Select
                    options={[
                      { value: 'none', label: 'No blocker' },
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
                    className="h-10 rounded-md"
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
          />
        </TaskField>

        <TaskField icon={FolderKanban} label="Project">
          <Pressable className="self-start active:opacity-70" onPress={() => router.push(backHref as any)}>
            <Text className="text-sm font-medium underline">{project?.name ?? 'Project'}</Text>
          </Pressable>
        </TaskField>
      </View>

      <View className="gap-4">
        <Text variant="muted">Properties</Text>
        <View className="flex-row flex-wrap gap-x-10 gap-y-6">
          <TaskField icon={Flag} label="Priority">
            <Select
              options={PRIORITIES}
              value={task.priority}
              onChange={(priority) => update.mutate({ id: task.id, priority })}
              renderValue={(option) => (
                <Badge variant={priorityVariant(option.value)} label={option.label} />
              )}
              className="h-10 rounded-md"
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
                className="h-9 rounded-md"
              />
            ) : (
              <Pressable
                className="self-start active:opacity-70"
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
      </View>

      <View className="min-h-[420px] gap-4 border-t border-border pt-5">
        <View className="flex-row items-center justify-between gap-4">
          <Text variant="title">Notes</Text>
          <Text variant="small">Markdown supported</Text>
        </View>

        {editing ? (
          <Textarea
          value={draft}
          onChangeText={setDraft}
          placeholder={'# Heading\n\nWrite anything — **bold**, lists, `code`, [links](https://example.com).'}
          className="min-h-[380px] rounded-none border-0 bg-transparent px-0 text-base focus:border-transparent"
        />
      ) : draft ? (
        <View className="min-h-[320px] py-1">
            <Markdown value={draft} />
        </View>
      ) : (
        <View className="min-h-[280px] items-start gap-3 py-2">
          <Text variant="muted">No notes yet. Write down the plan, links, or anything worth keeping.</Text>
          <Button variant="outline" label="Write notes" icon={Pencil} onPress={() => setEditing(true)} />
        </View>
      )}
      </View>

      {dirty && !editing ? <Text variant="small">Unsaved changes — switch to Edit to save them.</Text> : null}
    </Screen>
  );
}
