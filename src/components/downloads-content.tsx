import * as React from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bot, Download, Smartphone, type LucideIcon } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RELEASE_CHANNEL } from '@/lib/env';
import { useDownloads, downloadUrl, formatSize, type DownloadItem } from '@/lib/queries/downloads';

const OS_ICON: Record<DownloadItem['os'], LucideIcon> = {
  Android: Smartphone,
};

/** Best-guess of the current OS (web only) to flag the recommended build. */
function detectOS(): DownloadItem['os'] | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
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
          onPress={() => Linking.openURL(downloadUrl(item.assetId, RELEASE_CHANNEL))}
        />
      </CardContent>
    </Card>
  );
}

function PublicHeader() {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-row items-center gap-2.5">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Icon as={Bot} size={22} className="text-primary-foreground" />
        </View>
        <View>
          <Text className="text-lg font-extrabold tracking-tight">Gentoo</Text>
          <Text variant="small">FTC Team Hub</Text>
        </View>
      </View>
      <Button variant="outline" size="sm" label="Sign in" onPress={() => router.push('/sign-in')} />
    </View>
  );
}

export function DownloadsContent({ publicPage = false }: { publicPage?: boolean }) {
  const { data, isLoading, isError, refetch, isFetching } = useDownloads(RELEASE_CHANNEL);
  const detected = detectOS();
  // Drop platforms this build doesn't know about. The downloads function
  // deploys separately from the web app, so a not-yet-updated one can still
  // return a retired desktop platform off an older release — which would
  // otherwise render a card with no icon.
  const downloads = (data?.downloads ?? []).filter((item) => item.os in OS_ICON);
  const sorted = [...downloads].sort((a, b) =>
    a.os === detected ? -1 : b.os === detected ? 1 : 0
  );
  const isBeta = RELEASE_CHANNEL === 'beta';

  return (
    <Screen
      maxWidth="max-w-2xl"
      contentClassName={publicPage ? 'min-h-screen justify-center' : undefined}
    >
      {publicPage ? <PublicHeader /> : null}

      <ScreenHeader
        title={publicPage ? 'Download Gentoo' : 'Downloads'}
        description={isBeta ? 'Install the latest Gentoo beta app.' : 'Install the Gentoo app.'}
      >
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
          title="No builds yet"
          description="Installers will appear here once a build is published."
        />
      ) : (
        <View className="gap-3">
          {sorted.map((item) => (
            <DownloadCard key={item.assetId} item={item} recommended={item.os === detected} />
          ))}
          <Text variant="small" className="text-muted-foreground">
            The web app you’re using now always has the latest features. Android builds install
            from an APK.
          </Text>
        </View>
      )}
    </Screen>
  );
}
