import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { RotateCcw, Trash2 } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { useAuth } from '@/lib/auth';
import { priorityVariant, projectStatusVariant, labelOf } from '@/lib/task-style';
import { PRIORITIES, PROJECT_STATUSES } from '@/lib/types';
import {
  useTrashedProjects,
  useRestoreProject,
  useDeleteProject,
  type ProjectWithTasks,
} from '@/lib/queries/tasks';

function TrashedProjectCard({ project }: { project: ProjectWithTasks }) {
  const { isAdmin, session } = useAuth();
  const restore = useRestoreProject();
  const del = useDeleteProject();
  const canManage = isAdmin || project.created_by === session?.user?.id;
  const busy = restore.isPending || del.isPending;

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <View>
          <Text className="font-bold">{project.name}</Text>
          {project.description ? (
            <Text variant="muted" numberOfLines={1}>
              {project.description}
            </Text>
          ) : null}
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Badge variant={projectStatusVariant(project.status)} label={labelOf(PROJECT_STATUSES, project.status)} />
          <Badge variant={priorityVariant(project.priority)} label={labelOf(PRIORITIES, project.priority)} />
        </View>

        <View className="flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            label="Restore"
            icon={RotateCcw}
            disabled={busy}
            onPress={() => restore.mutate(project.id)}
            className="flex-1"
          />
          {canManage ? (
            <DeleteButton
              variant="outline"
              size="sm"
              label="Delete forever"
              icon={Trash2}
              disabled={busy}
              onPress={() => del.mutate(project.id)}
              className="flex-1"
            />
          ) : null}
        </View>
        {!canManage ? (
          <Text variant="small" className="text-muted-foreground">
            Only the project owner or an admin can permanently delete a project.
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function TrashScreen() {
  const { data: projects, isLoading } = useTrashedProjects();

  return (
    <Screen>
      <ScreenHeader
        title="Trash"
        description="Restore projects, or delete them permanently."
        backHref="/tasks"
      />

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : (projects ?? []).length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="Projects you move to trash show up here. You can restore them or delete them for good."
        />
      ) : (
        <View className="gap-3">
          {(projects ?? []).map((p) => (
            <TrashedProjectCard key={p.id} project={p} />
          ))}
        </View>
      )}
    </Screen>
  );
}
