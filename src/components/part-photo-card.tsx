import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { usePartPhotoUrl, useUpdatePart } from '@/lib/queries/inventory';
import {
  pickPhotoFromLibrary,
  removePartPhoto,
  takePhoto,
  uploadPartPhoto,
  type PickedPhoto,
} from '@/lib/part-photo';
import type { Part } from '@/lib/types';

/**
 * Reference photo for a part: what it actually looks like on the shelf, so the
 * right thing gets pulled from the bin.
 *
 * The bucket is private, so the image is fetched through a signed URL rather
 * than a stable public link (see lib/part-photo.ts).
 */
export function PartPhotoCard({ part }: { part: Part }) {
  const update = useUpdatePart();
  const { data: url, isLoading } = usePartPhotoUrl(part.image_path);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const attach = async (pick: () => Promise<PickedPhoto | null>) => {
    setError(null);
    try {
      const photo = await pick();
      if (!photo) return; // cancelled
      setBusy(true);
      const previous = part.image_path;
      const path = await uploadPartPhoto(part.id, photo);
      await update.mutateAsync({ id: part.id, image_path: path });
      // Only after the row points at the new object — orphaning a photo is
      // recoverable, pointing a row at a deleted one is not.
      if (previous && previous !== path) await removePartPhoto(previous);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that photo.');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setError(null);
    setBusy(true);
    try {
      const previous = part.image_path;
      await update.mutateAsync({ id: part.id, image_path: null });
      await removePartPhoto(previous);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        {part.image_path ? (
          <View className="relative aspect-square w-full">
            <View className="absolute inset-0 overflow-hidden rounded-md bg-muted">
              {isLoading || !url ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator />
                </View>
              ) : (
                <Image
                  source={url}
                  contentFit="cover"
                  transition={150}
                  style={{ width: '100%', height: '100%' }}
                  accessibilityLabel={`Photo of ${part.name}`}
                />
              )}
            </View>
            <View className="absolute right-2 top-2 z-10 rounded-md bg-background/80">
              <DeleteButton
                variant="ghost"
                size="icon"
                icon={X}
                accessibilityLabel="Remove photo"
                disabled={busy}
                onPress={clear}
              />
            </View>
          </View>
        ) : (
          <View className="items-center gap-1 rounded-md border border-dashed border-border py-6">
            <Icon as={ImagePlus} size={22} className="text-muted-foreground" />
            <Text variant="muted">No photo yet.</Text>
          </View>
        )}

        <View className="flex-row gap-3">
          <Button
            variant="outline"
            size="sm"
            label={part.image_path ? 'Replace' : 'Take photo'}
            icon={Camera}
            className="flex-1"
            disabled={busy}
            onPress={() => attach(takePhoto)}
          />
          <Button
            variant="outline"
            size="sm"
            label="Choose"
            icon={ImagePlus}
            className="flex-1"
            disabled={busy}
            onPress={() => attach(pickPhotoFromLibrary)}
          />
        </View>

        {busy ? <Text variant="small">Uploading…</Text> : null}
        {error ? (
          <Text variant="small" className="text-destructive">
            {error}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
