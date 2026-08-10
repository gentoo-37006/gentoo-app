import * as React from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, X } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { DeleteButton } from '@/components/ui/delete-button';
import { ModalSheet } from '@/components/ui/modal-sheet';
import { usePartPhotoUrl, useUpdatePart } from '@/lib/queries/inventory';
import {
  pickPhotoFromLibrary,
  removePartPhoto,
  takePhoto,
  uploadPartPhoto,
  type PickedPhoto,
} from '@/lib/part-photo';
import type { Part } from '@/lib/types';
import { cn } from '@/lib/utils';

function pickedPhotoFromFile(file: File): Promise<PickedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        uri: String(reader.result),
        mimeType: file.type || 'image/jpeg',
      });
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

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
  const [webPickerOpen, setWebPickerOpen] = React.useState(false);
  const [draggingOver, setDraggingOver] = React.useState(false);

  const attach = React.useCallback(async (pick: () => Promise<PickedPhoto | null>) => {
    setError(null);
    try {
      const photo = await pick();
      if (!photo) return false; // cancelled
      setBusy(true);
      const previous = part.image_path;
      const path = await uploadPartPhoto(part.id, photo);
      await update.mutateAsync({ id: part.id, image_path: path });
      // Only after the row points at the new object — orphaning a photo is
      // recoverable, pointing a row at a deleted one is not.
      if (previous && previous !== path) await removePartPhoto(previous);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that photo.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [part.id, part.image_path, update]);

  const attachWebFile = React.useCallback(async (file?: File | null) => {
    if (!file || busy) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    const saved = await attach(async () => pickedPhotoFromFile(file));
    if (saved) setWebPickerOpen(false);
  }, [attach, busy]);

  const openWebFilePicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      void attachWebFile(input.files?.[0]);
    }, { once: true });
    input.click();
  };

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !webPickerOpen) return;
    const pasteImage = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void attachWebFile(file);
    };
    window.addEventListener('paste', pasteImage);
    return () => window.removeEventListener('paste', pasteImage);
  }, [webPickerOpen, attachWebFile]);

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

  const choosePhotoSource = () => {
    if (Platform.OS === 'web') {
      setDraggingOver(false);
      setWebPickerOpen(true);
      return;
    }

    const takeNewPhoto = () => void attach(takePhoto);
    const chooseFromAlbum = () => void attach(pickPhotoFromLibrary);
    const title = part.image_path ? 'Replace image' : 'Add image';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: ['Cancel', 'Take Photo', 'Choose from Photo Album'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) takeNewPhoto();
          if (buttonIndex === 2) chooseFromAlbum();
        }
      );
      return;
    }

    Alert.alert(title, undefined, [
      { text: 'Take Photo', onPress: takeNewPhoto },
      { text: 'Choose from Photo Album', onPress: chooseFromAlbum },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        {part.image_path ? (
          <View className="relative aspect-square w-full">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replace reference image"
              disabled={busy}
              onPress={choosePhotoSource}
              className="absolute inset-0 cursor-pointer overflow-hidden rounded-md bg-muted hover:opacity-90"
            >
              {isLoading || !url ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator />
                </View>
              ) : (
                <Image
                  source={url}
                  contentFit="cover"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityLabel={`Photo of ${part.name}`}
                />
              )}
            </Pressable>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add reference image"
            disabled={busy}
            onPress={choosePhotoSource}
            className="cursor-pointer items-center gap-1 rounded-md border border-dashed border-border py-6 hover:bg-accent/70"
          >
            <Icon as={ImagePlus} size={22} className="text-muted-foreground" />
            <Text variant="muted">No reference image</Text>
          </Pressable>
        )}

        {error ? (
          <Text variant="small" className="text-destructive">
            {error}
          </Text>
        ) : null}
      </CardContent>

      <ModalSheet visible={webPickerOpen} onClose={() => setWebPickerOpen(false)}>
        <View className="select-none gap-3 rounded-md border border-border bg-card p-4">
          <Text variant="title">{part.image_path ? 'Replace image' : 'Add image'}</Text>
          {React.createElement(
            'div',
            {
              role: 'button',
              tabIndex: busy ? -1 : 0,
              'aria-disabled': busy,
              className: cn(
                'flex min-h-48 select-none items-center justify-center rounded-md border border-dashed border-border bg-muted/40 p-6 outline-none',
                busy ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-accent/70',
                draggingOver && !busy && 'border-primary bg-accent'
              ),
              onClick: () => {
                if (!busy) openWebFilePicker();
              },
              onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                if (busy) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                openWebFilePicker();
              },
              onDragEnter: (event: React.DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                if (!busy) setDraggingOver(true);
              },
              onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              },
              onDragLeave: () => setDraggingOver(false),
              onDrop: (event: React.DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setDraggingOver(false);
                if (busy) return;
                const file = Array.from(event.dataTransfer.files).find((item) =>
                  item.type.startsWith('image/')
                );
                void attachWebFile(file);
              },
            },
            <View pointerEvents="none" className="items-center gap-2">
              <Icon as={ImagePlus} size={28} className="text-primary" />
              <Text className="font-semibold">Drop or paste image</Text>
              <Text variant="muted">{busy ? 'Uploading…' : 'Choose file'}</Text>
            </View>
          )}
          {error ? (
            <Text variant="small" className="text-destructive">
              {error}
            </Text>
          ) : null}
        </View>
      </ModalSheet>
    </Card>
  );
}
