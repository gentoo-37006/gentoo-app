import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { RotateCcw, Trash2 } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteButton } from '@/components/ui/delete-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  useDeleteTaskForever,
  useProject,
  useRestoreTask,
  useTrashedTasks,
} from '@/lib/queries/tasks';
import { labelOf, priorityVariant, taskStatusVariant } from '@/lib/task-style';
import { PRIORITIES, TASK_STATUSES, type Task } from '@/lib/types';

function TrashedTaskCard({ task }: { task: Task }) {
  const restore = useRestoreTask();
  const permanentlyDelete = useDeleteTaskForever();
  const busy = restore.isPending || permanentlyDelete.isPending;

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <Text className="font-bold">{task.title}</Text>

        <View className="flex-row flex-wrap gap-2">
          <Badge
            variant={taskStatusVariant(task.status)}
            label={labelOf(TASK_STATUSES, task.status)}
          />
          <Badge
            variant={priorityVariant(task.priority)}
            label={labelOf(PRIORITIES, task.priority)}
          />
        </View>

        <View className="flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            label="Restore"
            icon={RotateCcw}
            disabled={busy}
            onPress={() => restore.mutate(task.id)}
            className="flex-1"
          />
          <DeleteButton
            variant="outline"
            size="sm"
            label="Delete forever"
            icon={Trash2}
            disabled={busy}
            onPress={() => permanentlyDelete.mutate(task.id)}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}

export default function TaskTrashScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const { data: tasks, isLoading } = useTrashedTasks(projectId);

  return (
    <Screen>
      <ScreenHeader
        title="Recently deleted"
        description={`Restore tasks from ${projectData?.project?.name ?? 'this project'}, or delete them permanently.`}
        backHref={`/projects/${projectId}`}
      />

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : (tasks ?? []).length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="Tasks deleted from this project will appear here."
        />
      ) : (
        <View className="gap-3">
          {(tasks ?? []).map((task) => (
            <TrashedTaskCard key={task.id} task={task} />
          ))}
        </View>
      )}
    </Screen>
  );
}
