import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListChecks, Plus, ChevronRight } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PROJECT_STATUSES, PRIORITIES } from '@/lib/types';
import { priorityVariant, projectStatusVariant, labelOf } from '@/lib/task-style';
import { useProjects, useCreateProject, type ProjectWithTasks } from '@/lib/queries/tasks';

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
  const createProject = useCreateProject();

  const addProject = () =>
    createProject.mutate({
      name: 'New project',
      status: 'planning',
      priority: 'medium',
    });

  return (
    <Screen>
      <ScreenHeader title="Projects" description="Organize work into projects and tasks.">
        <Button
          variant="outline"
          size="sm"
          label="Trash"
          accessibilityLabel="View trash"
          onPress={() => router.push('/tasks/trash' as any)}
        />
        <Button
          size="sm"
          label="New"
          icon={Plus}
          loading={createProject.isPending}
          disabled={createProject.isPending}
          onPress={addProject}
        />
      </ScreenHeader>

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
          <Button
            label="New project"
            icon={Plus}
            loading={createProject.isPending}
            disabled={createProject.isPending}
            onPress={addProject}
          />
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
