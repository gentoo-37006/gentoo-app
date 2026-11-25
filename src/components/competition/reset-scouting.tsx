import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Check, DatabaseZap, X } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ModalSheet } from '@/components/ui/modal-sheet';
import { Text } from '@/components/ui/text';
import { useResetScouting } from '@/lib/queries/scouting-reset';
import { RESET_PARTS, describeReset, type ScoutingResetOptions } from '@/lib/scouting-reset';
import { cn } from '@/lib/utils';

const CONFIRM_WORD = 'RESET';

function CheckRow({
  label,
  detail,
  checked,
  onToggle,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      className="flex-row items-start gap-3 rounded-md px-1 py-1.5 active:bg-accent"
    >
      <View
        className={cn(
          'mt-0.5 h-5 w-5 items-center justify-center rounded-sm border',
          checked ? 'border-destructive bg-destructive' : 'border-input bg-background'
        )}
      >
        {checked ? <Icon as={Check} size={14} className="text-destructive-foreground" /> : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold">{label}</Text>
        <Text variant="small">{detail}</Text>
      </View>
    </Pressable>
  );
}

/** Admins clear scouting data between events. Rendered only for admins. */
export function ResetScoutingCard() {
  const reset = useResetScouting();
  const [options, setOptions] = React.useState<ScoutingResetOptions>({ pit: true, matches: true, picklist: true });
  const [confirming, setConfirming] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const [message, setMessage] = React.useState<{ text: string; error: boolean } | null>(null);

  const chosen = RESET_PARTS.filter((part) => options[part.key]);
  const ready = typed.trim().toUpperCase() === CONFIRM_WORD;

  const close = () => {
    setConfirming(false);
    setTyped('');
  };

  const run = () =>
    reset.mutate(options, {
      onSuccess: (result) => {
        setMessage({ text: describeReset(result), error: false });
        close();
      },
      onError: (error) => {
        setMessage({ text: error.message || 'The reset failed. Nothing after the failed step was changed.', error: true });
        close();
      },
    });

  return (
    <Card className="border-destructive/40">
      <CardContent className="gap-3 p-5">
        <View className="flex-row items-center gap-2">
          <Icon as={DatabaseZap} size={16} className="text-destructive" />
          <Text variant="label" className="text-muted-foreground">
            Reset scouting data · admins
          </Text>
        </View>
        <Text variant="muted">
          Start the next event with clean scouting. The match schedule, team list and official standings stay; they come
          back from the FTC Scout sync anyway.
        </Text>
        <View className="gap-1">
          {RESET_PARTS.map((part) => (
            <CheckRow
              key={part.key}
              label={part.label}
              detail={part.detail}
              checked={options[part.key]}
              onToggle={() => setOptions((current) => ({ ...current, [part.key]: !current[part.key] }))}
            />
          ))}
        </View>
        {message ? (
          <Text variant="small" className={message.error ? 'text-destructive' : 'text-success'}>
            {message.text}
          </Text>
        ) : null}
        <View className="flex-row justify-end">
          <Button
            variant="destructive"
            label="Reset scouting data"
            disabled={chosen.length === 0 || reset.isPending}
            loading={reset.isPending}
            onPress={() => {
              setMessage(null);
              setConfirming(true);
            }}
          />
        </View>
      </CardContent>

      <ModalSheet visible={confirming} onClose={close}>
        <View className="w-full gap-4 rounded-md border border-border bg-card p-5">
          <View className="flex-row items-center justify-between">
            <Text variant="title">Reset scouting data?</Text>
            <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Cancel" onPress={close} />
          </View>
          <Text>This permanently deletes, for every event:</Text>
          <View className="gap-1.5">
            {chosen.map((part) => (
              <Text key={part.key} className="text-sm">
                • <Text className="text-sm font-semibold">{part.label}:</Text> {part.detail}
              </Text>
            ))}
          </View>
          <Text variant="muted">It can’t be undone. Type {CONFIRM_WORD} to confirm.</Text>
          <Input
            value={typed}
            onChangeText={setTyped}
            placeholder={CONFIRM_WORD}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
          />
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" label="Cancel" onPress={close} />
            <Button variant="destructive" label="Delete it" disabled={!ready || reset.isPending} loading={reset.isPending} onPress={run} />
          </View>
        </View>
      </ModalSheet>
    </Card>
  );
}
