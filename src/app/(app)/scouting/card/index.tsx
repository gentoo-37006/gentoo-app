import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Handshake, Link2, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { isCardExpired } from '@/lib/alliance-card';
import { cardLink, shareCardLink } from '@/lib/alliance-card-link';
import { timeUntil } from '@/lib/format';
import { useAllianceCards, useDeleteAllianceCard } from '@/lib/queries/alliance-cards';
import { useNow } from '@/lib/use-now';
import type { AllianceCard } from '@/lib/types';

function CardRow({ card, now }: { card: AllianceCard; now: number }) {
  const router = useRouter();
  const del = useDeleteAllianceCard();
  const [copied, setCopied] = React.useState(false);
  const link = cardLink(card.partner_team);

  const onShare = async () => {
    const outcome = await shareCardLink(link);
    setCopied(outcome === 'copied');
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-semibold">Team {card.partner_team}</Text>
          {card.partner_name ? <Text variant="muted">{card.partner_name}</Text> : null}
          <Badge variant="muted" label={`Expires ${timeUntil(card.expires_at, now)}`} />
        </View>
        <Text variant="small" selectable>
          {link}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            label="Open"
            icon={Pencil}
            onPress={() => router.push(`/scouting/card/${card.partner_team}` as any)}
          />
          <Button
            variant="outline"
            size="sm"
            label={copied ? 'Copied' : 'Share link'}
            icon={Link2}
            onPress={onShare}
          />
          <DeleteButton
            variant="outline"
            size="sm"
            label="Delete"
            icon={Trash2}
            disabled={del.isPending}
            onPress={() => del.mutate(card.partner_team)}
          />
        </View>
      </CardContent>
    </Card>
  );
}

export default function ScoutingCardsScreen() {
  const router = useRouter();
  const now = useNow();
  const { data: cards, isLoading } = useAllianceCards();
  // A card that ran out while this screen was open goes at once, without
  // waiting for the next fetch.
  const live = (cards ?? []).filter((card) => !isCardExpired(card.expires_at, now));

  return (
    <Screen maxWidth="max-w-3xl">
      <ScreenHeader
        title="Scouting cards"
        description="A page about our robot for an alliance partner. Each card is deleted one day after it was last saved."
        backHref="/scouting"
      >
        <Button
          variant="outline"
          size="sm"
          label="Edit form"
          icon={SlidersHorizontal}
          onPress={() => router.push('/scouting/card/form' as any)}
        />
      </ScreenHeader>

      <Button label="New card" icon={Plus} onPress={() => router.push('/scouting/card/new' as any)} />

      {isLoading ? (
        <View className="py-8">
          <ActivityIndicator />
        </View>
      ) : live.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No cards right now"
          description="Make one when you know who you are playing with, then send them the link."
        />
      ) : (
        <View className="gap-3">
          {live.map((card) => (
            <CardRow key={card.partner_team} card={card} now={now} />
          ))}
        </View>
      )}
    </Screen>
  );
}
