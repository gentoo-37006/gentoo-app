import * as React from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  ClipboardPaste,
  ExternalLink,
  Handshake,
  Link2,
  PenLine,
  Plus,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { OptionChips } from '@/components/ui/option-chips';
import { QrCode } from '@/components/ui/qr-code';
import { CardFieldInput } from '@/components/card-field-input';
import { FieldMap, PathLegend } from '@/components/field-map';
import {
  AUTON_FIELDS,
  DEFAULT_FIELD,
  MAX_AUTON_PATHS,
  MAX_PATH_NAME_LENGTH,
  parseAutonImport,
  parseTeamNumber,
  sketchPath,
  type AutonPlan,
  type CardField,
  type FieldId,
  type FieldPosition,
} from '@/lib/alliance-card';
import { cardLink, shareCardLink } from '@/lib/alliance-card-link';
import { useAuth } from '@/lib/auth';
import { timeUntil } from '@/lib/format';
import {
  useAllianceCard,
  useCardTemplate,
  useSaveAllianceCard,
} from '@/lib/queries/alliance-cards';
import { useTeamScores } from '@/lib/queries/scouting';
import { useNow } from '@/lib/use-now';
import type { AllianceCard } from '@/lib/types';

/** What to send the partner: the link, as text and as a code to scan in the pit. */
function LinkPanel({ card, now }: { card: AllianceCard; now: number }) {
  const { isDemo } = useAuth();
  const [copied, setCopied] = React.useState(false);
  const link = cardLink(card.partner_team);

  const onShare = async () => {
    const outcome = await shareCardLink(link);
    setCopied(outcome === 'copied');
  };

  return (
    <Card>
      <CardContent className="items-center gap-3 p-4">
        <Text variant="title" className="self-start">
          Link for team {card.partner_team}
        </Text>
        <QrCode value={link} size={168} className="rounded-md" />
        <Text selectable className="text-center">
          {link}
        </Text>
        <Text variant="muted" className="text-center">
          Expires {timeUntil(card.expires_at, now)}. Saving the card again restarts the day.
        </Text>
        {isDemo ? (
          <Text variant="muted" className="text-center">
            Demo mode keeps this card on this device, so the link will not open for a partner.
          </Text>
        ) : null}
        <View className="flex-row flex-wrap justify-center gap-2">
          <Button size="sm" label={copied ? 'Copied' : 'Share link'} icon={Link2} onPress={onShare} />
          <Button
            variant="outline"
            size="sm"
            label="Open page"
            icon={ExternalLink}
            onPress={() => Linking.openURL(link)}
          />
        </View>
      </CardContent>
    </Card>
  );
}

/** The paths the partner will see, sketched on the field here or pasted from the visualizer. */
function AutonEditor({
  plan,
  onChange,
}: {
  plan: AutonPlan | null;
  onChange: (plan: AutonPlan | null) => void;
}) {
  // Only used before there is a plan to hold the choice.
  const [fieldChoice, setFieldChoice] = React.useState<FieldId>(DEFAULT_FIELD);
  const [sketch, setSketch] = React.useState<FieldPosition[] | null>(null);
  const [sketchName, setSketchName] = React.useState('');
  const [importText, setImportText] = React.useState<string | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  const field = plan?.field ?? fieldChoice;
  const paths = plan?.paths ?? [];
  const full = paths.length >= MAX_AUTON_PATHS;

  const onField = (next: FieldId) => {
    setFieldChoice(next);
    if (plan) onChange({ ...plan, field: next });
  };

  const onAddSketch = () => {
    const path = sketch ? sketchPath(sketchName, sketch) : null;
    if (!path) return;
    onChange({ field, paths: [...paths, path] });
    setSketch(null);
    setSketchName('');
  };

  const onImport = () => {
    const result = parseAutonImport(importText ?? '');
    if ('error' in result) {
      setImportError(result.error);
      return;
    }
    const merged = [...paths, ...result.plan.paths].slice(0, MAX_AUTON_PATHS);
    // Pasted data only picks the field when there was no path to keep it for.
    onChange({ field: plan ? field : result.plan.field, paths: merged });
    setFieldChoice(plan ? field : result.plan.field);
    setImportText(null);
    setImportError(null);
  };

  const onRemove = (index: number) => {
    const next = paths.filter((_, i) => i !== index);
    onChange(next.length > 0 ? { field, paths: next } : null);
  };

  return (
    <Card>
      <CardContent className="gap-4 p-4">
        <View className="gap-1">
          <Text variant="title">Auton paths</Text>
          <Text variant="muted">Optional. The partner sees these drawn on the field.</Text>
        </View>

        <View className="gap-1.5">
          <Text variant="label">Field</Text>
          <OptionChips options={AUTON_FIELDS} value={field} onChange={onField} />
        </View>

        <FieldMap
          field={field}
          paths={paths}
          draft={sketch ?? undefined}
          onTap={sketch ? (position) => setSketch([...sketch, position]) : undefined}
        />

        {sketch ? (
          <View className="gap-3">
            <Text variant="muted">
              Tap the field where the robot starts, then each place it drives to, in order.
            </Text>
            <View className="gap-1.5">
              <Text variant="label">Path name</Text>
              <Input
                value={sketchName}
                onChangeText={setSketchName}
                placeholder={`Path ${paths.length + 1}`}
                maxLength={MAX_PATH_NAME_LENGTH}
              />
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button
                size="sm"
                label="Add path"
                icon={Check}
                disabled={sketch.length < 2}
                onPress={onAddSketch}
              />
              <Button
                variant="outline"
                size="sm"
                label="Undo point"
                icon={Undo2}
                disabled={sketch.length === 0}
                onPress={() => setSketch(sketch.slice(0, -1))}
              />
              <Button variant="outline" size="sm" label="Cancel" icon={X} onPress={() => setSketch(null)} />
            </View>
          </View>
        ) : (
          <>
            {paths.length > 0 ? (
              <PathLegend
                paths={paths}
                renderAction={(index) => (
                  <DeleteButton
                    variant="outline"
                    size="sm"
                    label="Remove"
                    icon={Trash2}
                    onPress={() => onRemove(index)}
                  />
                )}
              />
            ) : null}

            {importText === null ? (
              <View className="flex-row flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  label="Draw a path"
                  icon={PenLine}
                  disabled={full}
                  onPress={() => setSketch([])}
                />
                <Button
                  variant="outline"
                  size="sm"
                  label="Paste path data"
                  icon={ClipboardPaste}
                  disabled={full}
                  onPress={() => setImportText('')}
                />
              </View>
            ) : (
              <View className="gap-3">
                <View className="gap-1.5">
                  <Text variant="label">Path data from the auton visualizer</Text>
                  <Textarea
                    value={importText}
                    onChangeText={(text) => {
                      setImportText(text);
                      setImportError(null);
                    }}
                    placeholder='[{ "curves": [ … ] }]'
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {importError ? <Text className="text-destructive">{importError}</Text> : null}
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    size="sm"
                    label="Add paths"
                    icon={Plus}
                    disabled={!importText.trim()}
                    onPress={onImport}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    label="Cancel"
                    icon={X}
                    onPress={() => {
                      setImportText(null);
                      setImportError(null);
                    }}
                  />
                </View>
              </View>
            )}
            {full ? <Text variant="muted">A card holds up to {MAX_AUTON_PATHS} paths.</Text> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CardEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ team?: string }>();
  const isNew = params.team === 'new';
  const team = isNew ? null : parseTeamNumber(params.team ?? '');
  const now = useNow();

  const { data: card, isLoading: cardLoading } = useAllianceCard(team);
  const { data: template, isLoading: templateLoading } = useCardTemplate();
  const { data: scores } = useTeamScores();
  const save = useSaveAllianceCard();

  // Each draft is empty until its first edit; until then the screen follows the
  // saved card (or, for a new one, the form).
  const [teamInput, setTeamInput] = React.useState('');
  const [nameDraft, setNameDraft] = React.useState<string | null>(null);
  const [fieldsDraft, setFieldsDraft] = React.useState<CardField[] | null>(null);
  const [autonDraft, setAutonDraft] = React.useState<AutonPlan | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  if (!isNew && team == null) {
    return (
      <Screen maxWidth="max-w-3xl">
        <ScreenHeader title="Scouting card" backHref="/scouting/card" />
        <EmptyState icon={Handshake} title="That is not a team number" />
      </Screen>
    );
  }

  if ((isNew && templateLoading) || (!isNew && cardLoading)) {
    return (
      <Screen maxWidth="max-w-3xl">
        <ScreenHeader title="Scouting card" backHref="/scouting/card" />
        <View className="py-8">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!isNew && !card) {
    return (
      <Screen maxWidth="max-w-3xl">
        <ScreenHeader title={`Team ${team}`} backHref="/scouting/card" />
        <EmptyState
          icon={Handshake}
          title="No card for this team"
          description="It may have expired. Cards are deleted one day after they were last saved."
        >
          <Button label="New card" icon={Plus} onPress={() => router.replace('/scouting/card/new' as any)} />
        </EmptyState>
      </Screen>
    );
  }

  const partnerTeam = isNew ? parseTeamNumber(teamInput) : team;
  const knownName =
    (scores ?? []).find((score) => score.team_number === partnerTeam)?.team_name ?? '';
  const name = nameDraft ?? card?.partner_name ?? '';
  const fields = fieldsDraft ?? card?.fields ?? template ?? [];
  const plan = autonDraft !== undefined ? autonDraft : (card?.auton ?? null);
  const changed = nameDraft !== null || fieldsDraft !== null || autonDraft !== undefined;

  const onSave = async () => {
    setError(null);
    if (partnerTeam == null) {
      setError('Enter the team number of your alliance partner.');
      return;
    }
    try {
      const saved = await save.mutateAsync({
        partnerTeam,
        partnerName: name.trim() || knownName || null,
        fields,
        auton: plan,
      });
      setNameDraft(null);
      setFieldsDraft(null);
      setAutonDraft(undefined);
      if (isNew) router.replace(`/scouting/card/${saved.partner_team}` as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the card.');
    }
  };

  return (
    <Screen maxWidth="max-w-3xl">
      <ScreenHeader
        title={isNew ? 'New scouting card' : `Team ${team}`}
        description={
          isNew
            ? 'Fill in what your partner should know, then send them the link.'
            : (card?.partner_name ?? undefined)
        }
        backHref="/scouting/card"
      />

      {card && !changed ? <LinkPanel card={card} now={now} /> : null}

      <Card>
        <CardContent className="gap-4 p-4">
          {isNew ? (
            <View className="gap-1.5">
              <Text variant="label">Partner team number</Text>
              <Input
                value={teamInput}
                onChangeText={setTeamInput}
                keyboardType="number-pad"
                placeholder="e.g. 16417"
                maxLength={5}
              />
            </View>
          ) : null}
          <View className="gap-1.5">
            <Text variant="label">Partner team name (optional)</Text>
            <Input value={name} onChangeText={setNameDraft} placeholder={knownName || 'e.g. Out of the Box'} />
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="gap-4 p-4">
          <View className="gap-1">
            <Text variant="title">Our robot</Text>
            <Text variant="muted">Answers left empty are not shown to the partner.</Text>
          </View>
          {fields.length === 0 ? (
            <Text variant="muted">The form has no questions. Add some under Edit form.</Text>
          ) : (
            fields.map((field) => (
              <View key={field.id} className="gap-1.5">
                <Text variant="label">{field.label}</Text>
                <CardFieldInput
                  field={field}
                  onChangeText={(value) =>
                    setFieldsDraft(fields.map((f) => (f.id === field.id ? { ...f, value } : f)))
                  }
                />
              </View>
            ))
          )}
        </CardContent>
      </Card>

      <AutonEditor plan={plan} onChange={setAutonDraft} />

      {error ? <Text className="text-destructive">{error}</Text> : null}

      <Button
        label={isNew ? 'Create card' : changed ? 'Save changes' : 'Saved'}
        icon={Send}
        loading={save.isPending}
        disabled={save.isPending || (!isNew && !changed)}
        onPress={onSave}
        className="mb-6"
      />
    </Screen>
  );
}
