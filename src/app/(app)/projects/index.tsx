import * as React from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ListChecks, Plus, ChevronRight } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReorderableList } from '@/components/reorderable-list';
import { PROJECT_STATUSES, PRIORITIES } from '@/lib/types';
import { priorityVariant, projectStatusVariant, labelOf } from '@/lib/task-style';
import {
  useProjects,
  useCreateProject,
  useReorderProjects,
  type ProjectWithTasks,
} from '@/lib/queries/tasks';
import { cn } from '@/lib/utils';

const COMPLETED_LINE_HEIGHT =
  Platform.OS === 'web' ? 1 / PixelRatio.get() : StyleSheet.hairlineWidth;
const COMPLETED_LINE_DURATION_MS = 250;

function ProjectCard({
  project,
  onPress,
}: {
  project: ProjectWithTasks;
  onPress: () => void;
}) {
  const [cardHeight, setCardHeight] = React.useState(0);
  const [cardWidth, setCardWidth] = React.useState(0);
  const completed = project.status === 'done';
  const previousCompleted = React.useRef(completed);
  const completedLineProgress = useSharedValue(1);
  const completedLineTop = PixelRatio.roundToNearestPixel(
    (cardHeight - COMPLETED_LINE_HEIGHT) / 2
  );
  const completedLineAnimatedStyle = useAnimatedStyle(() => {
    const progress = completedLineProgress.value;
    const extension = Platform.OS === 'web' ? 16 : cardWidth * 0.015;
    return {
      transform: [
        {
          translateX:
            ((progress - 1) * cardWidth) / 2 - extension * (1 - progress),
        },
        {
          scaleX: progress * (Platform.OS === 'web' ? 1 : 1.03),
        },
      ],
    };
  });
  const open = project.tasks.length;

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
    <Pressable
      accessibilityRole="button"
      className="relative w-full overflow-visible rounded-md border border-border bg-card active:opacity-75 hover:bg-accent/70"
      onPress={onPress}
      onLayout={(event) => {
        setCardHeight(event.nativeEvent.layout.height);
        setCardWidth(event.nativeEvent.layout.width);
      }}
    >
          <View className={cn('gap-3 p-4', completed && 'opacity-60')}>
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="font-bold">{project.name}</Text>
                {project.description ? (
                  <Text variant="muted">
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
          </View>
          {completed && cardHeight > 0 ? (
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
                    ? ({
                        boxShadow: '-16px 0 0 currentColor, 16px 0 0 currentColor',
                      } as any)
                    : undefined
                }
              />
            </Animated.View>
          ) : null}
    </Pressable>
  );
}

function ProjectList({
  projects,
  onReorder,
  onOpenProject,
}: {
  projects: ProjectWithTasks[];
  onReorder: (projectIds: string[]) => void;
  onOpenProject: (projectId: string) => void;
}) {
  return (
    <ReorderableList
      items={projects}
      onReorder={onReorder}
      renderItem={(project) => (
        <ProjectCard project={project} onPress={() => onOpenProject(project.id)} />
      )}
    />
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const reorderProjects = useReorderProjects();

  const addProject = () =>
    createProject.mutate({
      name: 'New project',
      status: 'planning',
      priority: 'medium',
      sort_order:
        Math.max(0, ...(projects ?? []).map((project) => project.sort_order ?? 0)) + 10,
    });

  return (
    <Screen>
      <ScreenHeader title="Projects" description="Organize work into projects and tasks.">
        <Button
          variant="outline"
          size="sm"
          label="Trash"
          accessibilityLabel="View trash"
          onPress={() => router.push('/projects/trash' as any)}
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
        <ProjectList
          projects={projects ?? []}
          onReorder={(projectIds) => reorderProjects.mutate({ projectIds })}
          onOpenProject={(projectId) =>
            router.push(`/projects/${projectId}` as any)
          }
        />
      )}
    </Screen>
  );
}
