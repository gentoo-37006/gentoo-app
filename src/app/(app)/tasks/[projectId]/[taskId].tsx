import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Eye, FileX, Pencil } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/ui/markdown';
import { useProject, useUpdateTask } from '@/lib/queries/tasks';

export default function TaskNotesScreen() {
  const { projectId, taskId } = useLocalSearchParams<{ projectId: string; taskId: string }>();
  const { data, isLoading } = useProject(projectId);
  const update = useUpdateTask();
  const task = data?.tasks.find((t) => t.id === taskId);

  // Seed the draft once the task arrives; the page always opens in preview.
  const [loadedId, setLoadedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  if (task && loadedId !== task.id) {
    setLoadedId(task.id);
    setDraft(task.notes ?? '');
    setEditing(false);
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

  return (
    <Screen maxWidth="max-w-3xl">
      <ScreenHeader title={task.title} description="Notes · markdown supported" backHref={backHref}>
        <Button
          variant="outline"
          size="sm"
          label={editing ? 'Preview' : 'Edit'}
          icon={editing ? Eye : Pencil}
          onPress={() => setEditing((e) => !e)}
        />
        {editing ? (
          <Button size="sm" label="Save" loading={update.isPending} disabled={!dirty || update.isPending} onPress={save} />
        ) : null}
      </ScreenHeader>

      {editing ? (
        <Textarea
          value={draft}
          onChangeText={setDraft}
          placeholder={'# Heading\n\nWrite anything — **bold**, lists, `code`, [links](https://example.com).'}
          className="min-h-[420px] text-sm"
        />
      ) : draft ? (
        <Card>
          <CardContent className="p-5">
            <Markdown value={draft} />
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={Pencil} title="No notes yet" description="Write down the plan, links, or anything worth keeping.">
          <Button label="Write notes" icon={Pencil} onPress={() => setEditing(true)} />
        </EmptyState>
      )}

      {dirty && !editing ? <Text variant="small">Unsaved changes — switch to Edit to save them.</Text> : null}
    </Screen>
  );
}
