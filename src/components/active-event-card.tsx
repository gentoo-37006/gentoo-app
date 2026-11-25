import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import {
  Award,
  CalendarDays,
  ExternalLink,
  Globe,
  LayoutGrid,
  MapPin,
  Navigation,
  Trophy,
  Tv,
  type LucideIcon,
} from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { awardName, eventStatus, ourRecord } from '@/lib/competition';
import { timeAgo } from '@/lib/format';
import { eventDateRange, ftcScoutEventUrl } from '@/lib/ftcscout-event';
import { useFTCScoutAwards } from '@/lib/queries/ftcscout';
import { useMatches } from '@/lib/queries/matches';
import { useTeamScores } from '@/lib/queries/scouting';
import { OUR_TEAM_NUMBER } from '@/lib/team';
import { useActiveEvent } from '@/lib/use-active-event';
import { useNow } from '@/lib/use-now';
import { cn } from '@/lib/utils';

/** FTC Scout's event types, as people say them. */
const EVENT_TYPES: Record<string, string> = {
  Scrimmage: 'Scrimmage',
  LeagueMeet: 'League meet',
  Qualifier: 'Qualifier',
  LeagueTournament: 'League tournament',
  Championship: 'Championship',
  SuperQualifier: 'Super qualifier',
  FIRSTChampionship: 'FIRST Championship',
  OffSeason: 'Off-season event',
  Kickoff: 'Kickoff',
  Workshop: 'Workshop',
  DemoExhibition: 'Demo',
  VolunteerSignup: 'Volunteer sign-up',
  PracticeDay: 'Practice day',
  Premier: 'Premier event',
};

function Fact({ icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon as={icon} size={16} className="mt-0.5 text-muted-foreground" />
      <View className="min-w-0 flex-1 gap-0.5">{children}</View>
    </View>
  );
}

function LinkButton({ label, icon, url, accessibilityLabel }: { label: string; icon: LucideIcon; url: string; accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      className="flex-row items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 hover:bg-accent/70 active:bg-accent"
      onPress={() => Linking.openURL(url)}
    >
      <Icon as={icon} size={15} className="text-primary" />
      <Text className="text-sm font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="min-w-[84px] flex-1 gap-0.5 rounded-md border border-border bg-background px-3 py-2">
      <Text className="text-xl font-extrabold tabular-nums">{value}</Text>
      <Text variant="small">{label}</Text>
    </View>
  );
}

/** "Times are Eastern" only matters when the viewer's phone is somewhere else. */
function zoneNote(timezone: string | null | undefined): string | null {
  if (!timezone) return null;
  try {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!local || local === timezone) return null;
  } catch {
    return null;
  }
  return `Event time zone: ${timezone.replace(/_/g, ' ')}`;
}

export function ActiveEventCard() {
  const { setting, code, season, event, lastSynced } = useActiveEvent();
  const now = useNow();
  const status = event.data ? eventStatus(event.data, new Date(now)) : null;
  const teams = useTeamScores();
  const matches = useMatches();
  const awards = useFTCScoutAwards(code, season, { enabled: !!status && status.kind !== 'upcoming' });

  const details = event.data;
  const dates = details ? eventDateRange(details.start, details.end) : '';
  const location = details ? [details.city, details.state, details.country].filter(Boolean).join(', ') : '';
  const directions = details
    ? [details.venue, details.address, details.city, details.state, details.country].filter(Boolean).join(', ')
    : '';
  const synced = lastSynced ? timeAgo(lastSynced) : '';
  const us = (teams.data ?? []).find((team) => team.team_number === OUR_TEAM_NUMBER);
  const record = ourRecord(matches.data ?? [], OUR_TEAM_NUMBER);
  const played = record.wins + record.losses + record.ties;
  const official = us?.official_wins != null;
  const ourAwards = (awards.data ?? []).filter((award) => award.teamNumber === OUR_TEAM_NUMBER);
  const typeLabel = details?.type ? EVENT_TYPES[details.type] ?? details.type : null;
  const zone = zoneNote(details?.timezone);

  return (
    <Card>
      <CardContent className="gap-4 p-5">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={Trophy} size={16} className="text-primary" />
            <Text variant="label" className="text-muted-foreground">Active event</Text>
          </View>
          {status ? (
            <Badge
              variant={status.kind === 'live' ? 'success' : status.kind === 'upcoming' ? 'warning' : 'muted'}
              label={status.kind === 'live' ? `Live · ${status.label}` : status.label}
            />
          ) : null}
        </View>

        {setting.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading active event" />
        ) : setting.isError ? (
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
              <Text variant="title" className="break-words">{details?.name || code}</Text>
              <Text variant="muted">{code} · {season} season</Text>
              {typeLabel ? <Text variant="small">{typeLabel}{details?.remote ? ' · remote' : ''}</Text> : null}
            </View>
            {event.isLoading ? <ActivityIndicator accessibilityLabel="Loading event details" /> : null}
            {event.isError ? (
              <View className="items-start gap-2">
                <Text variant="muted">Event details unavailable.</Text>
                <Button label="Retry" variant="outline" size="sm" loading={event.isFetching} onPress={() => void event.refetch()} />
              </View>
            ) : null}

            <View className="gap-3">
              {dates ? (
                <Fact icon={CalendarDays}>
                  <Text>{dates}</Text>
                  {zone ? <Text variant="small">{zone}</Text> : null}
                </Fact>
              ) : null}
              {details?.venue || location ? (
                <Fact icon={MapPin}>
                  {details?.venue ? <Text>{details.venue}</Text> : null}
                  {details?.address ? <Text variant="muted">{details.address}</Text> : null}
                  {location ? <Text variant="muted">{location}</Text> : null}
                </Fact>
              ) : null}
              {details?.fieldCount || (teams.data?.length ?? 0) > 0 ? (
                <Fact icon={LayoutGrid}>
                  <Text>
                    {[
                      details?.fieldCount ? `${details.fieldCount} ${details.fieldCount === 1 ? 'field' : 'fields'}` : null,
                      teams.data?.length ? `${teams.data.length} teams` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Fact>
              ) : null}
            </View>

            <View className="gap-2">
              <Text variant="small" className="font-semibold uppercase tracking-wider">Our standing</Text>
              {official ? (
                <View className="flex-row flex-wrap gap-2">
                  <Stat value={us?.official_rank != null ? `#${us.official_rank}` : '—'} label="Rank" />
                  <Stat value={`${us?.official_wins ?? 0}-${us?.official_losses ?? 0}-${us?.official_ties ?? 0}`} label="W-L-T" />
                  <Stat value={us?.official_avg_points != null ? us.official_avg_points.toFixed(1) : '—'} label="Avg points" />
                </View>
              ) : played > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  <Stat value={`${record.wins}-${record.losses}-${record.ties}`} label="W-L-T so far" />
                </View>
              ) : (
                <Text variant="muted">No results for us yet.</Text>
              )}
            </View>

            {ourAwards.length > 0 ? (
              <View className="gap-2">
                <Text variant="small" className="font-semibold uppercase tracking-wider">Our awards</Text>
                {ourAwards.map((award) => (
                  <View key={`${award.type}-${award.placement}-${award.personName ?? ''}`} className="flex-row items-center gap-2">
                    <Icon as={Award} size={16} className="text-warning" />
                    <Text className="font-semibold">
                      {awardName(award.type, award.placement)}
                      {award.personName ? ` · ${award.personName}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="flex-row flex-wrap items-center gap-2">
              {details?.liveStreamURL ? <LinkButton label="Livestream" icon={Tv} url={details.liveStreamURL} /> : null}
              {details?.website ? <LinkButton label="Event website" icon={Globe} url={details.website} /> : null}
              {directions ? (
                <LinkButton
                  label="Directions"
                  icon={Navigation}
                  url={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directions)}`}
                />
              ) : null}
              <LinkButton
                label="FTCScout"
                icon={ExternalLink}
                accessibilityLabel="View event on FTCScout"
                url={ftcScoutEventUrl(season, code)}
              />
            </View>
            <Text variant="small" className={cn(!synced && 'italic')}>Last synced: {synced || 'Never'}</Text>
          </>
        )}
      </CardContent>
    </Card>
  );
}
