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
import { Input } from '@/components/ui/input';

const DEMO_EMAIL = 'alex.rivera@gentoorobotics.org';
const DEMO_PASSWORD = 'Gentoo2026!';

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

function EmailPasswordForm() {
  const { signInDemo } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onPress = async () => {
    setError(null);
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setError('Use Google sign-in unless you were given email and password credentials.');
      return;
    }
    setLoading(true);
    await signInDemo();
  };

  return (
    <View className="gap-3">
      <Input
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
      />
      <Input
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        textContentType="password"
      />
      <Pressable
        onPress={onPress}
        disabled={loading}
        className="h-12 flex-row items-center justify-center rounded-lg bg-primary active:opacity-85"
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text className="text-base font-semibold text-primary-foreground">Sign in</Text>
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
  const [showEmail, setShowEmail] = React.useState(false);

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
                Use your account to access the team workspace. New members need an admin to approve access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showEmail ? (
                <View className="gap-4">
                  <View className="flex-row gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <Icon as={TriangleAlert} size={16} className="mt-0.5 text-warning" />
                    <Text variant="small" className="flex-1 text-muted-foreground">
                      Only sign in with email and password if you were given credentials. You can&apos;t
                      create an account this way — most members should continue with Google.
                    </Text>
                  </View>
                  <EmailPasswordForm />
                  <Pressable onPress={() => setShowEmail(false)} className="self-center py-1">
                    <Text variant="small" className="text-muted-foreground underline">
                      Back to Google sign-in
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="gap-4">
                  {isConfigured ? <GoogleButton /> : <NotConfigured />}
                  <Pressable onPress={() => setShowEmail(true)} className="self-center py-1">
                    <Text variant="small" className="text-muted-foreground underline">
                      Sign in with email and password
                    </Text>
                  </Pressable>
                </View>
              )}
            </CardContent>
          </Card>
        </View>
      </View>
    </SafeAreaView>
  );
}
