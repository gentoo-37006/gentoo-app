import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useWebUpdateAvailable } from '@/lib/updates-web';

/**
 * Non-blocking banner shown when a newer web build is deployed. The user can
 * refresh to load it or keep working and dismiss. No-op on native and until an
 * update is detected.
 */
export function UpdateBanner() {
  const { available, channel, reload, dismiss } = useWebUpdateAvailable();
  const insets = useSafeAreaInsets();

  if (!available) return null;

  const message = channel === 'beta' ? 'A new beta build is available' : 'A new version is available';

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 items-center px-4"
      style={{ bottom: insets.bottom + 16 }}
    >
      <View className="w-full max-w-md flex-row items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
        <Icon as={RefreshCw} size={18} className="text-primary" />
        <View className="flex-1">
          <Text className="font-semibold">{message}</Text>
          <Text variant="small" className="text-muted-foreground">
            Refresh to update, or keep working.
          </Text>
        </View>
        <Button size="sm" variant="ghost" label="Later" onPress={dismiss} />
        <Button size="sm" label="Refresh" icon={RefreshCw} onPress={reload} />
      </View>
    </View>
  );
}
