import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Boxes, ChevronRight, Plus, Printer } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OptionChips } from '@/components/ui/option-chips';
import { ModalSheet } from '@/components/ui/modal-sheet';
import { PartEditor } from '@/components/part-editor';
import { groupPartsByCategory } from '@/lib/inventory-sort';
import { useParts, type PartWithOpen } from '@/lib/queries/inventory';
import { printLabels } from '@/lib/inventory-label';
import { labelOf } from '@/lib/task-style';
import { PART_CATEGORIES, checkedOutQuantity, isLowStock } from '@/lib/types';

type Filter = 'all' | 'out' | 'low';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'out', label: 'Checked out' },
  { value: 'low', label: 'Low stock' },
];

function PartRow({ part, onPress }: { part: PartWithOpen; onPress: () => void }) {
  const out = checkedOutQuantity(part.open);
  const available = Math.max(0, part.quantity - out);
  const low = isLowStock(part, available);
  const meta = [part.part_number, part.location].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      className="w-full gap-3 rounded-md border border-border bg-card p-4 active:opacity-75 hover:bg-accent/70"
      onPress={onPress}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="font-bold" numberOfLines={1}>
            {part.name}
          </Text>
          {meta ? (
            <Text variant="muted" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <View className="items-end">
          <Text className="text-lg font-extrabold">{available}</Text>
          <Text variant="small">
            {part.consumable ? part.unit || 'in stock' : `of ${part.quantity}`}
          </Text>
        </View>
        <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Badge variant="muted" label={labelOf(PART_CATEGORIES, part.category)} />
        {part.consumable ? <Badge variant="secondary" label="Consumable" /> : null}
        {out > 0 ? <Badge variant="taskInProgress" label={`${out} out`} /> : null}
        {low ? <Badge variant="warning" label="Low stock" /> : null}
      </View>
    </Pressable>
  );
}

function matchesQuery(part: PartWithOpen, query: string) {
  const haystack = [part.name, part.part_number, part.location, labelOf(PART_CATEGORIES, part.category)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export default function InventoryScreen() {
  const router = useRouter();
  const { data: parts, isLoading } = useParts();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');
  const [creating, setCreating] = React.useState(false);

  const all = parts ?? [];
  const search = query.trim().toLowerCase();
  const filtered = all.filter((part) => {
    if (search && !matchesQuery(part, search)) return false;
    const out = checkedOutQuantity(part.open);
    if (filter === 'out') return out > 0;
    if (filter === 'low') return isLowStock(part, Math.max(0, part.quantity - out));
    return true;
  });

  // Ordering is derived, not stored: categories A-Z, parts A-Z within each.
  const groups = groupPartsByCategory(filtered);

  return (
    <Screen>
      <ScreenHeader title="Inventory" description="Track parts, sign them out, and log what gets used up.">
        {Platform.OS === 'web' ? (
          <Button
            variant="outline"
            size="sm"
            label="Labels"
            icon={Printer}
            accessibilityLabel="Print QR labels"
            disabled={filtered.length === 0}
            onPress={() => printLabels(filtered)}
          />
        ) : null}
        <Button size="sm" label="New" icon={Plus} onPress={() => setCreating(true)} />
      </ScreenHeader>

      {all.length > 0 ? (
        <View className="gap-3">
          <Input value={query} onChangeText={setQuery} placeholder="Search parts, numbers, bins…" />
          <View className="flex-row items-center justify-between gap-3">
            <OptionChips options={FILTERS} value={filter} onChange={setFilter} />
            <Text variant="small">
              {filtered.length} of {all.length}
            </Text>
          </View>
        </View>
      ) : null}

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : all.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No parts yet"
          description="Add the parts your team keeps on the shelf. Each one gets a QR label you can print and scan to sign it out."
        >
          <Button label="New part" icon={Plus} onPress={() => setCreating(true)} />
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Boxes} title="No matches" description="Try a different search or filter." />
      ) : (
        <View className="gap-6">
          {groups.map((group) => (
            <View key={group.category} className="gap-3">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text variant="title">{group.label}</Text>
                <Text variant="small">{group.parts.length}</Text>
              </View>
              <View className="gap-3">
                {group.parts.map((part) => (
                  <PartRow
                    key={part.id}
                    part={part}
                    onPress={() => router.push(`/inventory/${part.id}` as any)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <ModalSheet visible={creating} onClose={() => setCreating(false)}>
        <PartEditor
          onDone={(createdId) => {
            setCreating(false);
            if (createdId) router.push(`/inventory/${createdId}` as any);
          }}
        />
      </ModalSheet>
    </Screen>
  );
}
