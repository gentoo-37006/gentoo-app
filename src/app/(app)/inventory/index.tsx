import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, type TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Boxes, ChevronRight, ImageOff, Plus, Printer } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { InventoryInput } from '@/components/inventory-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OptionChips } from '@/components/ui/option-chips';
import { ModalSheet } from '@/components/ui/modal-sheet';
import { PartEditor } from '@/components/part-editor';
import { groupPartsByCategory } from '@/lib/inventory-sort';
import { matchesSearch } from '@/lib/search';
import { usePartPhotoUrl, useParts, type PartWithOpen } from '@/lib/queries/inventory';
import { printLabels } from '@/lib/inventory-label';
import { labelOf } from '@/lib/task-style';
import { PART_CATEGORIES, checkedOutQuantity, isLowStock, type PartCategory } from '@/lib/types';

type Filter = 'all' | 'out' | 'low';
type CategoryFilter = PartCategory | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'out', label: 'Checked out' },
  { value: 'low', label: 'Low stock' },
];

function PartThumbnail({ part }: { part: PartWithOpen }) {
  const { data: url, isLoading } = usePartPhotoUrl(part.image_path);
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = React.useState<string | null>(null);

  return (
    <View className="min-h-16 flex-none self-stretch aspect-square items-center justify-center overflow-hidden rounded-sm bg-muted">
      {url && failedUrl !== url ? (
        <Image
          source={url}
          contentFit="cover"
          style={{
            width: '100%',
            height: '100%',
            opacity: loadedUrl === url ? 1 : 0,
          }}
          accessibilityLabel={`Photo of ${part.name}`}
          onLoad={() => setLoadedUrl(url)}
          onError={() => setFailedUrl(url)}
        />
      ) : part.image_path && isLoading ? null : (
        <View
          accessible
          accessibilityLabel={`No reference photo for ${part.name}`}
          className="items-center justify-center"
        >
          <Icon as={ImageOff} size={22} className="text-muted-foreground" />
        </View>
      )}
    </View>
  );
}

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
      <View className="flex-row items-start gap-3">
        <PartThumbnail part={part} />
        <View className="min-w-0 flex-1 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="min-w-0 flex-1">
              <Text className="font-bold">
                {part.name}
              </Text>
              {meta ? (
                <Text variant="muted" numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
            </View>
            <View className="shrink-0 self-start flex-row items-baseline gap-1">
              <Text className="text-lg font-extrabold">{available}</Text>
              <Text variant="small">
                {part.consumable ? part.unit || 'in stock' : `of ${part.quantity}`}
              </Text>
            </View>
            <Icon as={ChevronRight} size={20} className="text-muted-foreground" />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Badge variant="muted" label={labelOf(PART_CATEGORIES, part.category)} />
            {part.manufacturer ? <Badge variant="outline" label={part.manufacturer} /> : null}
            {part.consumable ? <Badge variant="secondary" label="Consumable" /> : null}
            {out > 0 ? <Badge variant="taskInProgress" label={`${out} out`} /> : null}
            {low ? <Badge variant="warning" label="Low stock" /> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function matchesQuery(part: PartWithOpen, query: string) {
  return matchesSearch(
    [
      part.name,
      part.part_number,
      part.manufacturer,
      part.location,
    ],
    query
  );
}

export default function InventoryScreen() {
  const router = useRouter();
  const { data: parts, isLoading } = useParts();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');
  const [category, setCategory] = React.useState<CategoryFilter>('all');
  const [creating, setCreating] = React.useState(false);
  const creatingRef = React.useRef(false);
  const searchInputRef = React.useRef<TextInput>(null);

  const setEditorOpen = React.useCallback((open: boolean) => {
    creatingRef.current = open;
    setCreating(open);
  }, []);

  const refocusSearch = React.useCallback(() => {
    if (Platform.OS !== 'web') return;
    requestAnimationFrame(() => {
      if (creatingRef.current || !searchInputRef.current) return;
      const input = searchInputRef.current as unknown as {
        focus: (options?: FocusOptions) => void;
      };
      input.focus({ preventScroll: true });
    });
  }, []);

  React.useEffect(() => {
    if (!creating) refocusSearch();
  }, [creating, refocusSearch]);

  useFocusEffect(
    React.useCallback(() => {
      refocusSearch();
    }, [refocusSearch])
  );

  const all = parts ?? [];
  // matchesSearch normalises case and punctuation on both sides; the trim only
  // keeps the short-circuit below from running the tokeniser on whitespace.
  const search = query.trim();
  const filtered = all.filter((part) => {
    if (search && !matchesQuery(part, search)) return false;
    if (category !== 'all' && part.category !== category) return false;
    const out = checkedOutQuantity(part.open);
    if (filter === 'out') return out > 0;
    if (filter === 'low') return isLowStock(part, Math.max(0, part.quantity - out));
    return true;
  });

  /**
   * Built from every part, never from `filtered` — deriving them from the
   * filtered set would collapse the row to just the chosen category and strand
   * the user there. Only categories that actually hold parts are offered, and
   * groupPartsByCategory already returns them A-Z by label.
   */
  const categoryOptions: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All categories' },
    ...groupPartsByCategory(all).map((group) => ({
      value: group.category as CategoryFilter,
      label: group.label,
    })),
  ];

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
        <Button size="sm" label="New" icon={Plus} onPress={() => setEditorOpen(true)} />
      </ScreenHeader>

      {all.length > 0 ? (
        <View className="gap-3">
          {/* Part names and SKUs are not prose: iOS autocorrect rewrites
              "odom" to "Odin" and sentence-cases the first letter, so a search
              box over this data has to opt out of both. */}
          <InventoryInput
            ref={searchInputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search parts, numbers, bins…"
            autoFocus={Platform.OS === 'web'}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="search"
            onBlur={Platform.OS === 'web' ? refocusSearch : undefined}
          />
          <View className="flex-row items-center justify-between gap-3">
            <OptionChips options={FILTERS} value={filter} onChange={setFilter} />
            <Text variant="small">
              {filtered.length} of {all.length}
            </Text>
          </View>
          {categoryOptions.length > 2 ? (
            <OptionChips options={categoryOptions} value={category} onChange={setCategory} />
          ) : null}
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
          <Button label="New part" icon={Plus} onPress={() => setEditorOpen(true)} />
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

      <ModalSheet visible={creating} onClose={() => setEditorOpen(false)}>
        <PartEditor
          onDone={(createdId) => {
            setEditorOpen(false);
            if (createdId) router.push(`/inventory/${createdId}` as any);
          }}
        />
      </ModalSheet>
    </Screen>
  );
}
