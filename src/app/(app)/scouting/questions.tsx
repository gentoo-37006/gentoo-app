import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Lock, Plus, Trash2, Minus, Eye, EyeOff } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import {
  useCapabilityQuestions,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
} from '@/lib/queries/scouting';
import type { CapabilityQuestion } from '@/lib/types';

function QuestionRow({ q }: { q: CapabilityQuestion }) {
  const update = useUpdateQuestion();
  const del = useDeleteQuestion();
  const busy = update.isPending || del.isPending;

  return (
    <Card className={q.active ? '' : 'opacity-60'}>
      <CardContent className="gap-3 p-4">
        <Text className="font-medium">{q.prompt}</Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge variant="secondary" label={q.category} />
          <View className="flex-row items-center gap-1 rounded-full border border-border px-1">
            <Pressable
              disabled={busy || q.weight <= 1}
              onPress={() => update.mutate({ id: q.id, weight: Math.max(1, q.weight - 1) })}
              className="h-6 w-6 items-center justify-center rounded-full active:bg-accent"
            >
              <Icon as={Minus} size={14} className="text-foreground" />
            </Pressable>
            <Text className="w-14 text-center text-xs font-semibold">Weight {q.weight}</Text>
            <Pressable
              disabled={busy}
              onPress={() => update.mutate({ id: q.id, weight: q.weight + 1 })}
              className="h-6 w-6 items-center justify-center rounded-full active:bg-accent"
            >
              <Icon as={Plus} size={14} className="text-foreground" />
            </Pressable>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            label={q.active ? 'Hide' : 'Show'}
            icon={q.active ? EyeOff : Eye}
            disabled={busy}
            onPress={() => update.mutate({ id: q.id, active: !q.active })}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            label="Delete"
            icon={Trash2}
            disabled={busy}
            onPress={() => del.mutate(q.id)}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}

function AddQuestion({ nextSortOrder }: { nextSortOrder: number }) {
  const create = useCreateQuestion();
  const [prompt, setPrompt] = React.useState('');
  const [category, setCategory] = React.useState('General');
  const [weight, setWeight] = React.useState('1');

  const onAdd = async () => {
    const w = parseInt(weight, 10);
    if (!prompt.trim()) return;
    await create.mutateAsync({
      prompt: prompt.trim(),
      category: category.trim() || 'General',
      weight: Number.isFinite(w) && w > 0 ? w : 1,
      sort_order: nextSortOrder,
    });
    setPrompt('');
    setWeight('1');
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <Text variant="title">Add question</Text>
        <View className="gap-1.5">
          <Text variant="label">Prompt</Text>
          <Input value={prompt} onChangeText={setPrompt} placeholder="Does the team…" />
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Text variant="label">Category</Text>
            <Input value={category} onChangeText={setCategory} placeholder="Autonomous" />
          </View>
          <View className="w-24 gap-1.5">
            <Text variant="label">Weight</Text>
            <Input value={weight} onChangeText={setWeight} keyboardType="number-pad" />
          </View>
        </View>
        <Button
          label="Add question"
          icon={Plus}
          loading={create.isPending}
          disabled={!prompt.trim() || create.isPending}
          onPress={onAdd}
        />
      </CardContent>
    </Card>
  );
}

export default function QuestionsScreen() {
  const { isAdmin } = useAuth();
  const { data: questions, isLoading } = useCapabilityQuestions(false);

  if (!isAdmin) {
    return (
      <Screen>
        <ScreenHeader title="Scouting questions" backHref="/scouting/pit" />
        <EmptyState icon={Lock} title="Admins only" description="Only admins can edit scouting questions." />
      </Screen>
    );
  }

  const nextSortOrder = (questions ?? []).reduce((m, q) => Math.max(m, q.sort_order), 0) + 10;

  return (
    <Screen>
      <ScreenHeader
        title="Scouting questions"
        description="These drive the pit form and the weighted pick-list score."
        backHref="/scouting/pit"
      />
      <AddQuestion nextSortOrder={nextSortOrder} />
      {isLoading ? (
        <View className="py-8">
          <ActivityIndicator />
        </View>
      ) : (
        <View className="gap-3">
          {(questions ?? []).map((q) => (
            <QuestionRow key={q.id} q={q} />
          ))}
        </View>
      )}
    </Screen>
  );
}
