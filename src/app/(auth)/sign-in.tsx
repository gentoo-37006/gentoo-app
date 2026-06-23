import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bot, TriangleAlert } from 'lucide-react-native';
import { signInWithGoogle } from '@/lib/google-auth';
import { useAuth } from '@/lib/auth';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GoogleLogo } from '@/components/google-logo';

function GoogleButton() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onPress = async () => {
    setError(null);
    setLoading(true);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
    // On success the auth listener drives navigation; on web the page redirects.
    if (result.error || result.cancelled) setLoading(false);
  };

  return (
    <View className="gap-3">
      <Pressable
        onPress={onPress}
        disabled={loading}
        className="h-12 flex-row items-center justify-center gap-3 rounded-lg border border-border bg-background active:bg-accent"
      >
        {loading ? (
          <ActivityIndicator size="small" />
        ) : (
          <>
            <GoogleLogo size={20} />
            <Text className="text-base font-semibold">Continue with Google</Text>
          </>
        )}
      </Pressable>
      {error ? (
        <Text variant="small" className="text-center text-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function NotConfigured() {
  return (
    <View className="gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <View className="flex-row items-center gap-2">
        <Icon as={TriangleAlert} size={18} className="text-warning" />
        <Text className="font-semibold">Backend not configured</Text>
      </View>
      <Text variant="muted">
        Add your Supabase URL and anon key to a local <Text className="font-mono text-xs">.env</Text>{' '}
        file (see <Text className="font-mono text-xs">.env.example</Text>) and enable the Google
        provider in Supabase, then reload.
      </Text>
    </View>
  );
}

export default function SignInScreen() {
  const { isConfigured } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-sm gap-8">
          <View className="items-center gap-3">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Icon as={Bot} size={32} className="text-primary-foreground" />
            </View>
            <View className="items-center">
              <Text className="text-2xl font-extrabold tracking-tight">Gentoo</Text>
              <Text variant="muted">FTC Team Hub</Text>
            </View>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Use your Google account. New members need an admin to approve access.
              </CardDescription>
            </CardHeader>
            <CardContent>{isConfigured ? <GoogleButton /> : <NotConfigured />}</CardContent>
          </Card>

          <Text variant="small" className="text-center">
            The first account to sign in becomes the team administrator.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
