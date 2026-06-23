import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, X, Eye, Send } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCapabilityQuestions, useSubmitPitEntry } from '@/lib/queries/scouting';
import type { AnswerValue, CapabilityQuestion } from '@/lib/types';

const OPTIONS: { value: AnswerValue; label: string; icon: typeof Check; active: string }[] = [
  { value: 'yes', label: 'Yes', icon: Check, active: 'border-success bg-success' },
  { value: 'no', label: 'No', icon: X, active: 'border-destructive bg-destructive' },
  { value: 'did_not_see', label: "Didn't see", icon: Eye, active: 'border-muted-foreground bg-muted-foreground' },
];

function AnswerSelector({
  value,
  onChange,
}: {
  value?: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={cn(
              'flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-2.5',
              active ? opt.active : 'border-border bg-background active:bg-accent'
            )}
          >
            <Icon
              as={opt.icon}
              size={16}
              className={active ? 'text-white' : 'text-muted-foreground'}
            />
            <Text className={cn('text-xs font-semibold', active ? 'text-white' : 'text-foreground')}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function groupByCategory(questions: CapabilityQuestion[]) {
  const groups: { category: string; questions: CapabilityQuestion[] }[] = [];
  for (const q of questions) {
    let group = groups.find((g) => g.category === q.category);
    if (!group) {
      group = { category: q.category, questions: [] };
      groups.push(group);
    }
    group.questions.push(q);
  }
  return groups;
}

export default function ScoutFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ teamNumber?: string; teamName?: string }>();
  const { data: questions, isLoading } = useCapabilityQuestions(true);
  const submit = useSubmitPitEntry();

  const [teamNumber, setTeamNumber] = React.useState(params.teamNumber ?? '');
  const [teamName, setTeamName] = React.useState(params.teamName ?? '');
  const [notes, setNotes] = React.useState('');
  const [answers, setAnswers] = React.useState<Record<string, AnswerValue>>({});
  const [error, setError] = React.useState<string | null>(null);

  const parsedNumber = parseInt(teamNumber.trim(), 10);
  const canSubmit = Number.isFinite(parsedNumber) && parsedNumber > 0 && !submit.isPending;

  const onSubmit = async () => {
    setError(null);
    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
      setError('Enter a valid team number.');
      return;
    }
    const answerList = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      const { teamId } = await submit.mutateAsync({
        teamNumber: parsedNumber,
        teamName: teamName.trim() || undefined,
        notes: notes.trim() || undefined,
        answers: answerList,
      });
      router.replace(`/scouting/pit/${teamId}` as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the report.');
    }
  };

  const groups = groupByCategory(questions ?? []);
  const answeredCount = Object.keys(answers).length;

  return (
    <Screen>
      <ScreenHeader
        title="Scout a team"
        description="Record what this team can do. Leave anything you didn’t check blank."
        backHref="/scouting/pit"
      />

      <Card>
        <CardContent className="gap-4 p-4">
          <View className="gap-1.5">
            <Text variant="label">Team number</Text>
            <Input
              value={teamNumber}
              onChangeText={setTeamNumber}
              keyboardType="number-pad"
              placeholder="e.g. 14584"
            />
          </View>
          <View className="gap-1.5">
            <Text variant="label">Team name (optional)</Text>
            <Input value={teamName} onChangeText={setTeamName} placeholder="e.g. Gentoo Robotics" />
          </View>
        </CardContent>
      </Card>

      {isLoading ? (
        <View className="py-8">
          <ActivityIndicator />
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.category} className="gap-3">
            <Text variant="title">{group.category}</Text>
            {group.questions.map((q) => (
              <Card key={q.id}>
                <CardContent className="gap-3 p-4">
                  <Text className="font-medium">{q.prompt}</Text>
                  <AnswerSelector
                    value={answers[q.id]}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                  />
                </CardContent>
              </Card>
            ))}
          </View>
        ))
      )}

      <View className="gap-1.5">
        <Text variant="label">Notes (optional)</Text>
        <Textarea value={notes} onChangeText={setNotes} placeholder="Anything else worth noting…" />
      </View>

      {error ? <Text className="text-destructive">{error}</Text> : null}

      <Button
        label={`Submit report${answeredCount ? ` (${answeredCount} answered)` : ''}`}
        icon={Send}
        loading={submit.isPending}
        disabled={!canSubmit}
        onPress={onSubmit}
        className="mb-6"
      />
    </Screen>
  );
}
