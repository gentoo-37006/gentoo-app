import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { CalendarDays, ExternalLink, MapPin, Trophy } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { eventDateRange, eventSeason, ftcScoutEventUrl } from '@/lib/ftcscout-event';
import { useFTCScoutEvent } from '@/lib/queries/ftcscout';
import { ACTIVE_EVENT_KEY, useAppSetting } from '@/lib/queries/settings';
import { useNow } from '@/lib/use-now';

export function ActiveEventCard() {
  const { isDemo } = useAuth();
  const setting = useAppSetting(ACTIVE_EVENT_KEY);
  const value = isDemo ? null : setting.data?.value;
  const code = typeof value?.eventCode === 'string' ? value.eventCode.trim() : '';
  const now = useNow();
  const season = eventSeason(value, new Date(now));
  const event = useFTCScoutEvent(code, season);
  const dates = event.data ? eventDateRange(event.data.start, event.data.end) : '';
  const location = event.data
    ? [event.data.city, event.data.state, event.data.country].filter(Boolean).join(', ')
    : '';
  const synced = typeof value?.last_synced === 'string' ? timeAgo(value.last_synced) : '';

  return (
    <Card>
      <CardContent className="gap-4 p-5">
        <View className="flex-row items-center gap-2">
          <Icon as={Trophy} size={16} className="text-primary" />
          <Text variant="label" className="text-muted-foreground">Active event</Text>
        </View>

        {!isDemo && setting.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading active event" />
        ) : !isDemo && setting.isError ? (
          <View className="items-start gap-2">
            <Text variant="muted">Active event unavailable.</Text>
            <Button label="Retry" variant="outline" size="sm" onPress={() => void setting.refetch()} />
          </View>
        ) : !code ? (
          <View className="items-start gap-2">
            <Text variant="title">No active event</Text>
            <Text variant="muted">Sync an event in Settings to see its details here.</Text>
            <Link href="/settings" asChild>
              <Pressable accessibilityRole="link" className="py-2 active:opacity-70">
                <Text className="font-semibold text-primary">Go to Settings</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <>
            <View className="min-w-0 gap-1">
              <Text variant="title" className="break-words">{event.data?.name || code}</Text>
              <Text variant="muted">{code} · {season} season</Text>
            </View>
            {event.isLoading ? (
              <ActivityIndicator accessibilityLabel="Loading event details" />
            ) : null}
            {event.isError ? (
              <View className="items-start gap-2">
                <Text variant="muted">Event details unavailable.</Text>
                <Button label="Retry" variant="outline" size="sm" loading={event.isFetching} onPress={() => void event.refetch()} />
              </View>
            ) : null}
            {dates ? (
              <View className="flex-row items-start gap-2">
                <Icon as={CalendarDays} size={16} className="mt-0.5 text-muted-foreground" />
                <Text className="min-w-0 flex-1">{dates}</Text>
              </View>
            ) : null}
            {event.data?.venue || location ? (
              <View className="flex-row items-start gap-2">
                <Icon as={MapPin} size={16} className="mt-0.5 text-muted-foreground" />
                <View className="min-w-0 flex-1 gap-1">
                  {event.data?.venue ? <Text>{event.data.venue}</Text> : null}
                  {location ? <Text variant="muted">{location}</Text> : null}
                </View>
              </View>
            ) : null}
            <View className="flex-row flex-wrap items-center justify-between gap-3">
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="View event on FTCScout"
                className="flex-row items-center gap-2 py-2 active:opacity-70"
                onPress={() => Linking.openURL(ftcScoutEventUrl(season, code))}
              >
                <Text className="font-semibold text-primary">View on FTCScout</Text>
                <Icon as={ExternalLink} size={16} className="text-primary" />
              </Pressable>
              <Text variant="small">Last synced: {synced || 'Never'}</Text>
            </View>
          </>
        )}
      </CardContent>
    </Card>
  );
}
