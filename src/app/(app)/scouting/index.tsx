import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import {
  ClipboardList,
  CalendarRange,
  Radio,
  ListOrdered,
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
    description: 'Verify each team’s capabilities and build the pick-list score.',
    icon: ClipboardList,
    href: '/scouting/pit',
  },
  {
    label: 'Match assignments',
    description: 'Assign scouters to matches and collect their reports.',
    icon: CalendarRange,
    soon: true,
  },
  {
    label: 'Talkie',
    description: 'Request live intel from the pit crew during matches.',
    icon: Radio,
    href: '/talkie',
  },
  {
    label: 'Pick-list',
    description: 'Tier and rank teams from scouted data for alliance selection.',
    icon: ListOrdered,
    soon: true,
  },
];

function SectionCard({ section }: { section: Section }) {
  const body = (
    <Card className={section.href ? 'active:opacity-90' : 'opacity-70'}>
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

  if (!section.href) return body;
  return (
    <Link href={section.href as any} asChild>
      <Pressable>{body}</Pressable>
    </Link>
  );
}

export default function ScoutingHub() {
  return (
    <Screen>
      <ScreenHeader title="Scouting" description="Everything your scouting team needs in one place." />
      <View className="gap-3">
        {SECTIONS.map((s) => (
          <SectionCard key={s.label} section={s} />
        ))}
      </View>
    </Screen>
  );
}
