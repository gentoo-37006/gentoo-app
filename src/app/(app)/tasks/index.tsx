import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListChecks, Plus, ChevronRight, Trash2 } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OptionChips } from '@/components/ui/option-chips';
import {
  PROJECT_STATUSES,
  PRIORITIES,
  type Priority,
  type ProjectStatus,
} from '@/lib/types';
import { priorityVariant, projectStatusVariant, labelOf } from '@/lib/task-style';
import { useProjects, useCreateProject, type ProjectWithTasks } from '@/lib/queries/tasks';

function CreateProject({ onClose }: { onClose: () => void }) {
  const create = useCreateProject();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<ProjectStatus>('planning');
  const [priority, setPriority] = React.useState<Priority>('medium');

  const onSubmit = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined, status, priority });
    onClose();
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <Text variant="title">New project</Text>
        <Input value={name} onChangeText={setName} placeholder="Project name" />
        <Textarea value={description} onChangeText={setDescription} placeholder="Description (optional)" className="min-h-[64px]" />
        <View className="gap-1.5">
          <Text variant="label">Status</Text>
          <OptionChips options={PROJECT_STATUSES} value={status} onChange={setStatus} />
        </View>
        <View className="gap-1.5">
          <Text variant="label">Priority</Text>
          <OptionChips options={PRIORITIES} value={priority} onChange={setPriority} />
        </View>
        <View className="flex-row gap-2">
          <Button variant="ghost" label="Cancel" onPress={onClose} className="flex-1" />
          <Button
            label="Create"
            icon={Plus}
            loading={create.isPending}
            disabled={!name.trim() || create.isPending}
            onPress={onSubmit}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}

function ProjectCard({ project }: { project: ProjectWithTasks }) {
  const router = useRouter();
  const open = project.tasks.length;
  return (
    <Pressable className="active:opacity-75" onPress={() => router.push(`/tasks/${project.id}` as any)}>
        <Card>
          <CardContent className="gap-3 p-4">
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-bold">{project.name}</Text>
                {project.description ? (
                  <Text variant="muted" numberOfLines={1}>
                    {project.description}
                  </Text>
                ) : null}
              </View>
              <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Badge variant={projectStatusVariant(project.status)} label={labelOf(PROJECT_STATUSES, project.status)} />
              <Badge variant={priorityVariant(project.priority)} label={labelOf(PRIORITIES, project.priority)} />
            </View>
            <Text variant="small">
              {open === 0 ? 'All clear — no open tasks' : open === 1 ? '1 open task' : `${open} open tasks`}
            </Text>
          </CardContent>
        </Card>
    </Pressable>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const [creating, setCreating] = React.useState(false);

  return (
    <Screen>
      <ScreenHeader title="Projects" description="Organize work into projects and tasks.">
        <Button
          variant="outline"
          size="icon"
          icon={Trash2}
          accessibilityLabel="View trash"
          onPress={() => router.push('/tasks/trash' as any)}
        />
        {!creating ? <Button label="New" icon={Plus} onPress={() => setCreating(true)} /> : null}
      </ScreenHeader>

      {creating ? <CreateProject onClose={() => setCreating(false)} /> : null}

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : (projects ?? []).length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No projects yet"
          description="Create a project, then break it into tasks with assignees, due dates, priorities, and tags."
        >
          {!creating ? <Button label="New project" icon={Plus} onPress={() => setCreating(true)} /> : null}
        </EmptyState>
      ) : (
        <View className="gap-3">
          {(projects ?? []).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </View>
      )}
    </Screen>
  );
}
