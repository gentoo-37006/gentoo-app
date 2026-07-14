import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ClipboardList,
  CalendarRange,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';

type Section = {
  label: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  soon?: boolean;
};

const SECTIONS: Section[] = [
  {
    label: 'Pit scouting',
    description: 'Verify each team’s capabilities in the pit.',
    icon: ClipboardList,
    href: '/scouting/pit',
  },
  {
    label: 'Match assignments',
    description: 'Assign scouters to matches and collect their reports.',
    icon: CalendarRange,
    href: '/scouting/matches',
  },
];

function SectionCard({ section }: { section: Section }) {
  const router = useRouter();
  const card = (
    <Card className={!section.href ? 'opacity-70' : undefined}>
      <CardContent className="flex-row items-center gap-4 p-4">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-accent">
          <Icon as={section.icon} size={22} className="text-primary" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-semibold">{section.label}</Text>
            {section.soon ? <Badge variant="muted" label="Soon" /> : null}
          </View>
          <Text variant="muted">{section.description}</Text>
        </View>
        {section.href ? <Icon as={ChevronRight} size={20} className="text-muted-foreground" /> : null}
      </CardContent>
    </Card>
  );

  if (!section.href) return card;
  return (
    <Pressable className="active:opacity-75" onPress={() => router.push(section.href as any)}>
      {card}
    </Pressable>
  );
}

export default function ScoutingHub() {
  return (
    <Screen>
      <ScreenHeader title="Scouting" description="Pit and match scouting for data collection." />
      <View className="gap-3">
        {SECTIONS.map((s) => (
          <SectionCard key={s.label} section={s} />
        ))}
      </View>
    </Screen>
  );
}
