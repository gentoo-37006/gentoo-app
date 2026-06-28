import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Camera, ImagePlus, Cable } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GROQ_API_KEY } from '@/lib/env';

const PROMPT =
  'You are inventorying a photo of FTC (FIRST Tech Challenge) robot wiring parts. ' +
  'Do a complete visual inventory, not just the large cable coils. Count every visible distinct item type, including cables, harnesses, adapters, jumpers, zip ties, loose connectors, brackets, switches, and small REV/FTC electronics pieces. ' +
  'Scan the image systematically from top-left to bottom-right and include small items near the bottom and edges. ' +
  'Common FTC wiring items include: zip ties, servo extension cables, JST-PH encoder/sensor cables, JST-VH motor/power cables, Anderson PowerPole cables, XT30 battery/power cables, REV grounding straps, power switch assemblies, USB-A, USB-C, USB mini-B, ethernet/RJ45, barrel jack, and connector housings. ' +
  'Count individual visible pieces or complete cable assemblies. If several identical pieces are laid out separately, count each one. If a bundled coil clearly contains multiple identical cables because multiple connectors are visible, count the visible cable assemblies, not just the coil. ' +
  'Use specific names, but do not invent items that are not visible. ' +
  'Do not use vague labels like "small adapter boards/connectors", "miscellaneous cables", "various connectors", or "electronics pieces". Do not label a part as a relay just because it is black, inline, taped, or attached to wires; connector housings, switch leads, zip ties, grounding straps, adapters, and cable bundles are not relays. Only include "relay module" if a distinct relay module/block is clearly visible as its own component. Do not label small white/black connector housings, plastic adapters, REV boards, or loose connector bodies as ferrules. Only include ferrules if bare metal crimp sleeves are clearly visible. If uncertain, use "unidentified small wiring part" or "unidentified connector" instead of "relay module" or "ferrules". If you can identify a small part, name it specifically. ' +
  'Return only a JSON object where keys are item type names and values are integer counts. ' +
  'Example: {"zip ties": 25, "JST-PH sensor cable": 6, "XT30 power cable": 3, "servo extension cable": 4, "connector housing": 8, "unidentified small wiring part": 6}.';

type CableCounts = Record<string, number>;

const EXCLUDED_RESULT_NAMES = [/relay/i, /ferrule/i];

async function countCablesWithGroq(base64: string, mimeType: string): Promise<CableCounts> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 2048,
      temperature: 0,
      seed: 42,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `Groq error ${res.status}`);
  }

  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const raw = JSON.parse(jsonMatch ? jsonMatch[0] : text.trim()) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(raw)
      .map(([name, value]) => [name, Number(value)] as const)
      .filter(([name]) => !EXCLUDED_RESULT_NAMES.some((pattern) => pattern.test(name)))
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .map(([name, value]) => [name, Math.round(value)])
  );
}

export default function CablesScreen() {
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [counts, setCounts] = React.useState<CableCounts | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const analyze = async (base64: string, mimeType: string) => {
    setLoading(true);
    setCounts(null);
    setError(null);
    try {
      const result = await countCablesWithGroq(base64, mimeType);
      setCounts(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setCounts(null);
      setError(null);
      if (asset.base64) {
        await analyze(asset.base64, asset.mimeType ?? 'image/jpeg');
      }
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setCounts(null);
      setError(null);
      if (asset.base64) {
        await analyze(asset.base64, asset.mimeType ?? 'image/jpeg');
      }
    }
  };

  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0;

  return (
    <Screen>
      <ScreenHeader
        title="Cable counter"
        description="Snap a photo of FTC wiring parts and AI will inventory each visible type."
        backHref="/"
      />

      <View className="flex-row gap-3">
        <Button
          label="Take photo"
          icon={Camera}
          onPress={takePhoto}
          className="flex-1"
          disabled={loading}
        />
        <Button
          label="Choose image"
          icon={ImagePlus}
          variant="outline"
          onPress={pickFromLibrary}
          className="flex-1"
          disabled={loading}
        />
      </View>

      {imageUri ? (
        <Image
          source={imageUri}
          style={{ width: '100%', height: 220, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="items-center gap-3 py-8">
            <ActivityIndicator size="large" />
            <Text variant="muted">Analyzing cables…</Text>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="gap-2 p-4">
            <Text className="font-semibold text-destructive">Analysis failed</Text>
            <Text variant="muted">{error}</Text>
            <Button
              label="Try another image"
              variant="outline"
              onPress={() => {
                setImageUri(null);
                setError(null);
              }}
              className="mt-1"
            />
          </CardContent>
        </Card>
      ) : counts ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="title">Results</Text>
            <Badge variant="muted" label={`${total} total`} />
          </View>
          {Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <Card key={type}>
                <CardContent className="flex-row items-center gap-3 p-4">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
                    <Icon as={Cable} size={20} className="text-primary" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold capitalize">{type.replace(/-/g, ' ')}</Text>
                    <Text variant="muted">{count === 1 ? '1 cable' : `${count} cables`}</Text>
                  </View>
                  <Text className="text-2xl font-extrabold text-primary">{count}</Text>
                </CardContent>
              </Card>
            ))}
        </View>
      ) : null}
    </Screen>
  );
}
