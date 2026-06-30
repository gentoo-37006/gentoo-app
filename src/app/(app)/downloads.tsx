import * as React from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { Download, Laptop, Monitor, type LucideIcon } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDownloads, downloadUrl, formatSize, type DownloadItem } from '@/lib/queries/downloads';

const OS_ICON: Record<DownloadItem['os'], LucideIcon> = {
  macOS: Laptop,
  Windows: Monitor,
};

/** Best-guess of the current desktop OS (web only) to flag the recommended build. */
function detectOS(): DownloadItem['os'] | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return 'macOS';
  if (/Win/i.test(ua)) return 'Windows';
  return null;
}

function DownloadCard({ item, recommended }: { item: DownloadItem; recommended: boolean }) {
  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Icon as={OS_ICON[item.os]} size={20} className="text-foreground" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-bold">{item.os}</Text>
              {recommended ? <Badge variant="secondary" label="Your device" /> : null}
            </View>
            <Text variant="muted">{item.label}</Text>
          </View>
        </View>

        <Text variant="small" className="font-mono text-muted-foreground" numberOfLines={1}>
          {item.filename} · {formatSize(item.size)}
        </Text>

        <Button
          label={`Download for ${item.os}`}
          icon={Download}
          onPress={() => Linking.openURL(downloadUrl(item.assetId))}
        />
      </CardContent>
    </Card>
  );
}

export default function DownloadsScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useDownloads();
  const detected = detectOS();

  const downloads = data?.downloads ?? [];
  // Show the recommended platform first.
  const sorted = [...downloads].sort((a, b) =>
    a.os === detected ? -1 : b.os === detected ? 1 : 0
  );

  return (
    <Screen maxWidth="max-w-2xl">
      <ScreenHeader title="Downloads" description="Install the Gentoo desktop app.">
        {data?.version ? <Badge variant="muted" label={data.version} /> : null}
      </ScreenHeader>

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <EmptyState
          icon={Download}
          title="Couldn’t load downloads"
          description="Something went wrong fetching the latest builds. Please try again."
        >
          <Button variant="outline" label="Retry" loading={isFetching} onPress={() => refetch()} />
        </EmptyState>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Download}
          title="No desktop builds yet"
          description="Desktop installers will appear here once a release is published."
        />
      ) : (
        <View className="gap-3">
          {sorted.map((item) => (
            <DownloadCard key={item.assetId} item={item} recommended={item.os === detected} />
          ))}
          <Text variant="small" className="text-muted-foreground">
            The web app you’re using now always has the latest features — desktop apps are optional.
            macOS builds are for Apple Silicon; Windows builds are 64-bit.
          </Text>
        </View>
      )}
    </Screen>
  );
}
