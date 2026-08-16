import * as React from 'react';
import { Platform, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { InventoryInput } from '@/components/inventory-input';
import { AutoGrowingTextInput } from '@/components/ui/auto-growing-text-input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { Icon } from '@/components/ui/icon';
import { Select } from '@/components/ui/select';
import { OptionChips } from '@/components/ui/option-chips';
import { useCreatePart, useParts, useUpdatePart, type PartInput } from '@/lib/queries/inventory';
import { distinctManufacturers } from '@/lib/inventory-sort';
import { PART_CATEGORIES, type Part, type PartCategory } from '@/lib/types';

const KIND_OPTIONS: { value: 'durable' | 'consumable'; label: string }[] = [
  { value: 'durable', label: 'Durable' },
  { value: 'consumable', label: 'Consumable' },
];

const ADD_MANUFACTURER = '__add_manufacturer__';

const toCount = (value: string) => Math.max(0, Math.round(Number(value) || 0));

/** Create/edit form for a part. `initial` omitted means a new part. */
export function PartEditor({
  initial,
  onDone,
  onDelete,
  deleting = false,
}: {
  initial?: Part;
  /** Position a newly created part lands at; ignored when editing. */
  onDone: (createdId?: string) => void;
  onDelete?: () => void | Promise<void>;
  deleting?: boolean;
}) {
  const create = useCreatePart();
  const { data: allParts } = useParts();
  const update = useUpdatePart();
  const [name, setName] = React.useState(initial?.name ?? '');
  const [category, setCategory] = React.useState<PartCategory>(initial?.category ?? 'other');
  const [partNumber, setPartNumber] = React.useState(initial?.part_number ?? '');
  const [manufacturer, setManufacturer] = React.useState(initial?.manufacturer ?? '');
  const [location, setLocation] = React.useState(initial?.location ?? '');
  const [quantity, setQuantity] = React.useState(String(initial?.quantity ?? 0));
  const [consumable, setConsumable] = React.useState(initial?.consumable ?? false);
  const [unit, setUnit] = React.useState(initial?.unit ?? '');
  const [lowStock, setLowStock] = React.useState(
    !initial?.consumable || initial.low_stock_at == null ? '' : String(initial.low_stock_at)
  );
  const [notes, setNotes] = React.useState(initial?.notes ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const busy = create.isPending || update.isPending || deleting;
  const manufacturerOptions = React.useMemo(() => {
    const existing = distinctManufacturers(allParts ?? [], allParts?.length ?? 0);
    const current = manufacturer.trim();
    if (current && !existing.some((value) => value.toLowerCase() === current.toLowerCase())) {
      existing.push(current);
    }

    return [
      { value: ADD_MANUFACTURER, label: 'Add new manufacturer' },
      ...existing.map((value) => ({ value, label: value })),
    ];
  }, [allParts, manufacturer]);
  const selectedManufacturer = manufacturerOptions.find(
    (option) =>
      option.value !== ADD_MANUFACTURER &&
      option.value.toLowerCase() === manufacturer.trim().toLowerCase()
  )?.value;

  const onSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const fields: PartInput = {
      name: name.trim(),
      category,
      part_number: partNumber.trim() || null,
      manufacturer: manufacturer.trim() || null,
      location: location.trim() || null,
      quantity: toCount(quantity),
      consumable,
      unit: consumable ? unit.trim() || null : null,
      low_stock_at: consumable && lowStock.trim() ? toCount(lowStock) : null,
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
    <Card
      className={
        Platform.OS === 'web'
          ? 'select-none border-primary/40'
          : 'flex-1 select-none rounded-none border-0 bg-background'
      }
    >
      <CardContent className="gap-3 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="title">{initial ? 'Edit part' : 'New part'}</Text>
          {initial && onDelete ? (
            <DeleteButton
              variant="ghost"
              size="icon"
              icon={Trash2}
              accessibilityLabel="Delete part"
              loading={deleting}
              onPress={onDelete}
            />
          ) : null}
        </View>
        <AutoGrowingTextInput
          minHeight={44}
          value={name}
          onChangeText={setName}
          placeholder="Part name"
          className="min-h-11 select-text rounded-lg border border-input bg-background px-3.5 py-2 text-base outline-none focus:border-input"
        />

        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Text variant="label">Category</Text>
            <Select
              options={PART_CATEGORIES}
              value={category}
              onChange={setCategory}
              // Borderless, but keep the trigger's px-3.5 so the value lines up
              // with the bordered fields stacked above and below it.
              className="h-11 rounded-md border-transparent bg-transparent"
            />
          </View>
          <View className="flex-1 gap-1.5">
            <Text variant="label">Part number</Text>
            <InventoryInput
              value={partNumber}
              onChangeText={setPartNumber}
              placeholder="REV-41-1301"
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View className="gap-1.5">
          <Text variant="label">Manufacturer</Text>
          <Select
            options={manufacturerOptions}
            value={selectedManufacturer ?? null}
            onChange={(value, query) => {
              if (value === ADD_MANUFACTURER) {
                const nextManufacturer = query?.trim();
                if (!nextManufacturer) return false;
                setManufacturer(nextManufacturer);
                return;
              }
              setManufacturer(value);
            }}
            placeholder="No manufacturer"
            className="h-11 rounded-md border-transparent bg-transparent"
            pinnedValues={[ADD_MANUFACTURER]}
            renderValue={(option) =>
              option.value === ADD_MANUFACTURER ? (
                <View className="flex-row items-center gap-2">
                  <Icon as={Plus} size={16} className="text-primary" />
                  <Text className="text-sm font-medium text-primary">{option.label}</Text>
                </View>
              ) : (
                <Text className="text-sm font-medium">{option.label}</Text>
              )
            }
          />
        </View>

        <View className="gap-1.5">
          <Text variant="label">Type</Text>
          <OptionChips
            options={KIND_OPTIONS}
            value={consumable ? 'consumable' : 'durable'}
            onChange={(value) => {
              const nextConsumable = value === 'consumable';
              setConsumable(nextConsumable);
              if (!nextConsumable) setLowStock('');
            }}
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
            <InventoryInput value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          </View>
          {consumable ? (
            <View className="flex-1 gap-1.5">
              <Text variant="label">Unit</Text>
              <InventoryInput value={unit} onChangeText={setUnit} placeholder="g, spools…" autoCapitalize="none" />
            </View>
          ) : null}
          {consumable ? (
            <View className="flex-1 gap-1.5">
              <Text variant="label">Low at</Text>
              <InventoryInput
                value={lowStock}
                onChangeText={setLowStock}
                placeholder="Off"
                keyboardType="number-pad"
              />
            </View>
          ) : null}
        </View>

        <View className="gap-1.5">
          <Text variant="label">Location</Text>
          <InventoryInput value={location} onChangeText={setLocation} placeholder="Bin A2, shelf B…" />
        </View>

        <View className="gap-1.5">
          <Text variant="label">Notes</Text>
          <Textarea
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional"
            className="select-text outline-none focus:border-input"
          />
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
