import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Upload } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { parseMatchesCsv } from '@/lib/csv';
import { useImportMatches } from '@/lib/queries/matches';

const SAMPLE = `match,red1,red2,blue1,blue2
1,14584,9876,1234,5678
2,1234,14584,9876,5678`;

export default function ImportMatchesScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const importer = useImportMatches();
  const [csv, setCsv] = React.useState('');

  const { rows, errors } = React.useMemo(() => parseMatchesCsv(csv), [csv]);

  if (!isAdmin) {
    return (
      <Screen>
        <ScreenHeader title="Import schedule" backHref="/scouting/matches" />
        <EmptyState icon={Lock} title="Admins only" description="Only admins can import the match schedule." />
      </Screen>
    );
  }

  const onImport = async () => {
    await importer.mutateAsync(rows);
    router.replace('/scouting/matches' as any);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Import schedule"
        description="Paste the match schedule as CSV. Existing match numbers are updated."
        backHref="/scouting/matches"
      />

      <Card>
        <CardContent className="gap-2 p-4">
          <Text variant="label">Format</Text>
          <Text variant="muted" className="font-mono text-xs">
            match number, red1, red2, blue1, blue2
          </Text>
        </CardContent>
      </Card>

      <Textarea
        value={csv}
        onChangeText={setCsv}
        placeholder={SAMPLE}
        className="min-h-[160px] font-mono text-sm"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {csv.trim().length > 0 ? (
        <Card>
          <CardContent className="gap-2 p-4">
            <Text className="font-semibold">
              {rows.length} {rows.length === 1 ? 'match' : 'matches'} detected
            </Text>
            {rows.slice(0, 6).map((r) => (
              <Text key={r.match_number} variant="muted" className="font-mono text-xs">
                #{r.match_number}: {r.red1 ?? '?'} & {r.red2 ?? '?'} vs {r.blue1 ?? '?'} & {r.blue2 ?? '?'}
              </Text>
            ))}
            {rows.length > 6 ? <Text variant="small">…and {rows.length - 6} more</Text> : null}
            {errors.length > 0 ? (
              <Text className="text-destructive">{errors.length} line(s) skipped</Text>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Button
        label={`Import ${rows.length || ''} ${rows.length === 1 ? 'match' : 'matches'}`.replace('  ', ' ')}
        icon={Upload}
        loading={importer.isPending}
        disabled={rows.length === 0 || importer.isPending}
        onPress={onImport}
        className="mb-6"
      />
    </Screen>
  );
}
