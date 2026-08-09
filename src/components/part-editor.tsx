import * as React from 'react';
import { View } from 'react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { OptionChips } from '@/components/ui/option-chips';
import { useCreatePart, useUpdatePart, type PartInput } from '@/lib/queries/inventory';
import { PART_CATEGORIES, type Part, type PartCategory } from '@/lib/types';

const KIND_OPTIONS: { value: 'durable' | 'consumable'; label: string }[] = [
  { value: 'durable', label: 'Durable' },
  { value: 'consumable', label: 'Consumable' },
];

const toCount = (value: string) => Math.max(0, Math.round(Number(value) || 0));

/** Create/edit form for a part. `initial` omitted means a new part. */
export function PartEditor({
  initial,
  onDone,
}: {
  initial?: Part;
  /** Position a newly created part lands at; ignored when editing. */
  onDone: (createdId?: string) => void;
}) {
  const create = useCreatePart();
  const update = useUpdatePart();
  const [name, setName] = React.useState(initial?.name ?? '');
  const [category, setCategory] = React.useState<PartCategory>(initial?.category ?? 'other');
  const [partNumber, setPartNumber] = React.useState(initial?.part_number ?? '');
  const [location, setLocation] = React.useState(initial?.location ?? '');
  const [quantity, setQuantity] = React.useState(String(initial?.quantity ?? 0));
  const [consumable, setConsumable] = React.useState(initial?.consumable ?? false);
  const [unit, setUnit] = React.useState(initial?.unit ?? '');
  const [lowStock, setLowStock] = React.useState(
    initial?.low_stock_at == null ? '' : String(initial.low_stock_at)
  );
  const [notes, setNotes] = React.useState(initial?.notes ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const onSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const fields: PartInput = {
      name: name.trim(),
      category,
      part_number: partNumber.trim() || null,
      location: location.trim() || null,
      quantity: toCount(quantity),
      consumable,
      unit: consumable ? unit.trim() || null : null,
      low_stock_at: lowStock.trim() ? toCount(lowStock) : null,
      notes: notes.trim() || null,
      // Photos are managed on the part's own page; carry the existing one
      // through so saving an edit here never silently drops it.
      image_path: initial?.image_path ?? null,
    };
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...fields });
      onDone();
    } else {
      onDone(await create.mutateAsync(fields));
    }
  };

  return (
    <Card className="border-primary/40">
      <CardContent className="gap-3 p-4">
        <Text variant="title">{initial ? 'Edit part' : 'New part'}</Text>
        <Input value={name} onChangeText={setName} placeholder="Part name" />

        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Text variant="label">Category</Text>
            <Select options={PART_CATEGORIES} value={category} onChange={setCategory} />
          </View>
          <View className="flex-1 gap-1.5">
            <Text variant="label">Part number</Text>
            <Input
              value={partNumber}
              onChangeText={setPartNumber}
              placeholder="REV-41-1301"
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View className="gap-1.5">
          <Text variant="label">Type</Text>
          <OptionChips
            options={KIND_OPTIONS}
            value={consumable ? 'consumable' : 'durable'}
            onChange={(value) => setConsumable(value === 'consumable')}
          />
          <Text variant="small">
            {consumable
              ? 'Used up when taken — logging usage lowers the stock count.'
              : 'Signed out and returned — quantity stays with the team.'}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Text variant="label">{consumable ? 'In stock' : 'Quantity'}</Text>
            <Input value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          </View>
          {consumable ? (
            <View className="flex-1 gap-1.5">
              <Text variant="label">Unit</Text>
              <Input value={unit} onChangeText={setUnit} placeholder="g, spools…" autoCapitalize="none" />
            </View>
          ) : null}
          <View className="flex-1 gap-1.5">
            <Text variant="label">Low at</Text>
            <Input
              value={lowStock}
              onChangeText={setLowStock}
              placeholder="Off"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View className="gap-1.5">
          <Text variant="label">Location</Text>
          <Input value={location} onChangeText={setLocation} placeholder="Bin A2, shelf B…" />
        </View>

        <View className="gap-1.5">
          <Text variant="label">Notes</Text>
          <Input value={notes} onChangeText={setNotes} placeholder="Optional" />
        </View>

        {error ? <Text className="text-destructive">{error}</Text> : null}

        <View className="flex-row gap-2">
          <Button variant="ghost" label="Cancel" onPress={() => onDone()} className="flex-1" />
          <Button
            label={initial ? 'Save' : 'Add part'}
            loading={busy}
            disabled={busy}
            onPress={onSave}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}
