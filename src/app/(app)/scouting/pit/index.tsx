import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClipboardList, Plus, SlidersHorizontal, Search } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useTeamScores } from '@/lib/queries/scouting';
import { officialSummary } from '@/lib/scoring';
import type { TeamScore } from '@/lib/types';

function TeamCard({ team }: { team: TeamScore }) {
  const router = useRouter();
  const official = officialSummary(team);
  return (
    <Pressable className="active:opacity-75" onPress={() => router.push(`/scouting/pit/${team.team_id}` as any)}>
        <Card>
          <CardContent className="flex-row items-center justify-between gap-3 p-4">
            <View className="flex-1">
              <Text className="text-base font-bold">Team {team.team_number}</Text>
              <Text variant="muted" numberOfLines={1}>
                {team.team_name ?? 'Unknown name'}
              </Text>
              {official ? <Text variant="small">{official}</Text> : null}
            </View>
            <Badge
              variant="muted"
              label={`${team.entry_count} ${team.entry_count === 1 ? 'report' : 'reports'}`}
            />
          </CardContent>
        </Card>
    </Pressable>
  );
}

export default function PitScoutingList() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { data: teams, isLoading } = useTeamScores();
  const [search, setSearch] = React.useState('');

  const filtered = (teams ?? []).filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(t.team_number).includes(q) || (t.team_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <Screen>
      <ScreenHeader title="Pit scouting" description="Scout teams and record their capabilities." backHref="/scouting">
        {isAdmin ? (
          <Button
            variant="outline"
            size="icon"
            icon={SlidersHorizontal}
            accessibilityLabel="Edit questions"
            onPress={() => router.push('/scouting/questions' as any)}
          />
        ) : null}
        <Button label="Scout" icon={Plus} onPress={() => router.push('/scouting/pit/scout' as any)} />
      </ScreenHeader>

      <View className="flex-row items-center gap-2 rounded-lg border border-input bg-background px-3">
        <Icon as={Search} size={18} className="text-muted-foreground" />
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search team number or name"
          className="h-11 flex-1 border-0 px-0"
        />
      </View>

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search ? 'No matching teams' : 'No teams scouted yet'}
          description={
            search
              ? 'Try a different team number or name.'
              : 'Tap “Scout” to log a team’s capabilities and start building the pick-list.'
          }
        >
          {!search ? (
            <Button label="Scout a team" icon={Plus} onPress={() => router.push('/scouting/pit/scout' as any)} />
          ) : null}
        </EmptyState>
      ) : (
        <View className="gap-3">
          {filtered.map((t) => (
            <TeamCard key={t.team_id} team={t} />
          ))}
        </View>
      )}
    </Screen>
  );
}
