import { View } from 'react-native';
import { ClipboardList, CalendarRange, Radio, ListOrdered, type LucideIcon } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';

type Section = { label: string; description: string; icon: LucideIcon };

const SECTIONS: Section[] = [
  { label: 'Pit scouting', description: 'Verify each team’s capabilities and build the pick-list score.', icon: ClipboardList },
  { label: 'Match assignments', description: 'Assign scouters to matches and collect their reports.', icon: CalendarRange },
  { label: 'Talkie', description: 'Request live intel from the pit crew during matches.', icon: Radio },
  { label: 'Pick-list', description: 'Tier and rank teams from scouted data for alliance selection.', icon: ListOrdered },
];

export default function ScoutingScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Scouting"
        description="Everything your scouting team needs in one place."
      />
      <View className="flex-row flex-wrap gap-3">
        {SECTIONS.map((s) => (
          <Card key={s.label} className="flex-1 basis-full md:basis-[48%]">
            <CardContent className="gap-3 p-5">
              <View className="flex-row items-center justify-between">
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-accent">
                  <Icon as={s.icon} size={22} className="text-primary" />
                </View>
                <Badge variant="muted" label="Coming together" />
              </View>
              <Text variant="title">{s.label}</Text>
              <Text variant="muted">{s.description}</Text>
            </CardContent>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
