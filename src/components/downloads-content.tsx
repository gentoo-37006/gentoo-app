import * as React from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { Download, Smartphone, type LucideIcon } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RELEASE_CHANNEL, isSupabaseConfigured } from '@/lib/env';
import { useDownloads, downloadUrl, formatSize, type DownloadItem } from '@/lib/queries/downloads';

/** The published iOS app. Hard-coded rather than fetched: the App Store listing
 *  is not a GitHub release asset, so the downloads function never returns it. */
const APP_STORE_URL = 'https://apps.apple.com/us/app/gentoo/id6785305308';

/** Everything installable, including the platforms with no downloadable asset. */
type InstallPlatform = DownloadItem['os'] | 'iOS';

const OS_ICON: Record<DownloadItem['os'], LucideIcon> = {
  Android: Smartphone,
};

/** Best-guess of the current OS (web only) to flag the recommended build. */
function detectOS(): InstallPlatform | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  // iPadOS 13+ ships a desktop Safari user agent, so an iPad is indistinguishable
  // from a Mac by UA alone — the touch-point count is what separates them.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'iOS';
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

function AppStoreCard({ recommended, beta }: { recommended: boolean; beta: boolean }) {
  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Icon as={Smartphone} size={20} className="text-foreground" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-bold">iOS</Text>
              {recommended ? <Badge variant="secondary" label="Your device" /> : null}
            </View>
            {/* The App Store only ever serves the reviewed release, so say so on
                the beta site rather than implying this is the beta build. */}
            <Text variant="muted">
              {beta ? 'iPhone and iPad · App Store release' : 'iPhone and iPad'}
            </Text>
          </View>
        </View>

        <Button
          label="Get it on the App Store"
          icon={Download}
          onPress={() => Linking.openURL(APP_STORE_URL)}
        />
      </CardContent>
    </Card>
  );
}

export function DownloadsContent({
  publicPage = false,
  returnToPending = false,
}: {
  publicPage?: boolean;
  returnToPending?: boolean;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useDownloads(RELEASE_CHANNEL);
  const detected = detectOS();
  // Drop platforms this build doesn't know about. The downloads function
  // deploys separately from the web app, so a not-yet-updated one can still
  // return a retired desktop platform off an older release — which would
  // otherwise render a card with no icon.
  const downloads = (data?.downloads ?? []).filter((item) => item.os in OS_ICON);
  // Ranked rather than compared inline: chaining the two equality checks
  // narrows `detected` down the false branch, and the second one then reads
  // as a comparison against a type Android can never be.
  const rank = (item: DownloadItem) => (item.os === detected ? 0 : 1);
  const sorted = [...downloads].sort((a, b) => rank(a) - rank(b));
  const isBeta = RELEASE_CHANNEL === 'beta';
  // Static, so it renders in every state — an iPhone still has somewhere to go
  // when the downloads function is unconfigured, failing, or has no assets yet.
  // It leads unless the visitor is on Android, whose own build comes first.
  const appStore = <AppStoreCard recommended={detected === 'iOS'} beta={isBeta} />;

  return (
    <Screen maxWidth="max-w-2xl">
      <ScreenHeader
        title="Downloads"
        description={isBeta ? 'Install the latest Gentoo beta app.' : 'Install the Gentoo app.'}
        backHref={publicPage ? (returnToPending ? '/pending' : '/sign-in') : undefined}
      >
        {data?.version ? <Badge variant="muted" label={data.version} /> : null}
      </ScreenHeader>

      <View className="gap-3">
        {detected === 'Android' ? null : appStore}

        {!isSupabaseConfigured ? (
          <EmptyState
            icon={Download}
            title="Backend not configured"
            description="This build has no Supabase credentials, so it can't reach the downloads function. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY and rebuild."
          />
        ) : isLoading ? (
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
            title="No Android builds yet"
            description="Android installers will appear here once a build is published."
          />
        ) : (
          sorted.map((item) => (
            <DownloadCard key={item.assetId} item={item} recommended={item.os === detected} />
          ))
        )}

        {detected === 'Android' ? appStore : null}

        <Text variant="small" className="text-muted-foreground">
          The web app you’re using now always has the latest features. iOS installs from the App
          Store; Android installs from an APK.
        </Text>
      </View>
    </Screen>
  );
}
