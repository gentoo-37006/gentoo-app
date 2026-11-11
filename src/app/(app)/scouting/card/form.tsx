import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { OptionChips } from '@/components/ui/option-chips';
import { CardFieldInput } from '@/components/card-field-input';
import {
  CARD_FIELD_KINDS,
  MAX_CARD_FIELDS,
  MAX_LABEL_LENGTH,
  type CardField,
} from '@/lib/alliance-card';
import { useCardTemplate, useSaveCardTemplate } from '@/lib/queries/alliance-cards';

function FieldEditor({
  field,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: {
  field: CardField;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<CardField>) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <View className="gap-1.5">
          <Text variant="label">Question</Text>
          <Input
            value={field.label}
            onChangeText={(label) => onChange({ label })}
            placeholder="e.g. Auton points"
            maxLength={MAX_LABEL_LENGTH}
          />
        </View>
        <View className="gap-1.5">
          <Text variant="label">Answer type</Text>
          <OptionChips options={CARD_FIELD_KINDS} value={field.kind} onChange={(kind) => onChange({ kind })} />
        </View>
        <View className="gap-1.5">
          <Text variant="label">Our usual answer</Text>
          <CardFieldInput
            field={field}
            onChangeText={(value) => onChange({ value })}
            placeholder="Filled in on every new card"
          />
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            label="Up"
            icon={ArrowUp}
            disabled={isFirst}
            onPress={() => onMove(-1)}
          />
          <Button
            variant="outline"
            size="sm"
            label="Down"
            icon={ArrowDown}
            disabled={isLast}
            onPress={() => onMove(1)}
          />
          <DeleteButton variant="outline" size="sm" label="Remove" icon={Trash2} onPress={onRemove} />
        </View>
      </CardContent>
    </Card>
  );
}

export default function CardFormScreen() {
  const { data: template, isLoading } = useCardTemplate();
  const save = useSaveCardTemplate();
  // null until the first edit: until then the screen follows the saved form,
  // including a teammate's change arriving over realtime.
  const [draft, setDraft] = React.useState<CardField[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fields = draft ?? template ?? [];

  const update = (next: CardField[]) => {
    setError(null);
    setDraft(next);
  };

  const onAdd = () => {
    update([
      ...fields,
      { id: `field-${Date.now().toString(36)}`, label: '', kind: 'text', value: '' },
    ]);
  };

  const onMove = (index: number, step: -1 | 1) => {
    const target = index + step;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  const onSave = async () => {
    if (!draft) return;
    if (draft.some((field) => !field.label.trim())) {
      setError('Every question needs a name. Fill it in or remove it.');
      return;
    }
    try {
      await save.mutateAsync(draft);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the form.');
    }
  };

  return (
    <Screen maxWidth="max-w-3xl">
      <ScreenHeader
        title="Card form"
        description="The questions on every scouting card, and our usual answers. Changing them here does not change cards already sent."
        backHref="/scouting/card"
      />

      {isLoading ? (
        <View className="py-8">
          <ActivityIndicator />
        </View>
      ) : (
        <View className="gap-3">
          {fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              field={field}
              isFirst={index === 0}
              isLast={index === fields.length - 1}
              onChange={(patch) => update(fields.map((f) => (f.id === field.id ? { ...f, ...patch } : f)))}
              onMove={(step) => onMove(index, step)}
              onRemove={() => update(fields.filter((f) => f.id !== field.id))}
            />
          ))}
        </View>
      )}

      <Button
        variant="outline"
        label="Add question"
        icon={Plus}
        disabled={fields.length >= MAX_CARD_FIELDS}
        onPress={onAdd}
      />

      {error ? <Text className="text-destructive">{error}</Text> : null}

      <Button
        label={draft ? 'Save form' : 'Saved'}
        icon={Save}
        loading={save.isPending}
        disabled={!draft || save.isPending}
        onPress={onSave}
        className="mb-6"
      />
    </Screen>
  );
}
