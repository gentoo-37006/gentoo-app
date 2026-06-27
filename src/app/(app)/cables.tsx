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
  'This is a photo of FTC (FIRST Tech Challenge) robotics cables. ' +
  'Identify and count each distinct cable type you can see. ' +
  'Common FTC cable types include: Anderson PowerPole, JST-VH (motor/servo power), ' +
  'JST-PH (encoder/sensor), XT30, servo (3-pin), USB-A, USB-C, USB mini-B, ' +
  'ethernet/RJ45, and barrel jack. ' +
  'Reply with only a JSON object where keys are cable type names and values are integer counts. ' +
  'Example: {"Anderson PowerPole": 4, "JST-VH": 3, "servo": 6}. ' +
  'Only include types actually visible in the image. Return only the JSON, nothing else.';

type CableCounts = Record<string, number>;

async function countCablesWithGroq(base64: string, mimeType: string): Promise<CableCounts> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 1024,
      temperature: 0,
      seed: 42,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
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
  return JSON.parse(jsonMatch ? jsonMatch[0] : text.trim());
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
      quality: 0.7,
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
      quality: 0.7,
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
        description="Snap a photo of cables and AI will identify and count each type."
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
