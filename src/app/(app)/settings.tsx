import * as React from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';
import { useColorScheme } from 'nativewind';
import { Sun, Moon, SunMoon, type LucideIcon } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Pressable } from 'react-native';
import { cn } from '@/lib/utils';

type Mode = 'light' | 'dark' | 'system';
const MODES: { value: Mode; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: SunMoon },
];

function AppearancePicker() {
  const { setColorScheme } = useColorScheme();
  const [mode, setMode] = React.useState<Mode>('system');

  return (
    <View className="flex-row gap-2">
      {MODES.map((m) => {
        const active = mode === m.value;
        return (
          <Pressable
            key={m.value}
            onPress={() => {
              setMode(m.value);
              setColorScheme(m.value);
            }}
            className={cn(
              'flex-1 items-center gap-1.5 rounded-lg border px-3 py-3',
              active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent'
            )}
          >
            <Icon
              as={m.icon}
              size={20}
              className={active ? 'text-primary-foreground' : 'text-muted-foreground'}
            />
            <Text
              className={cn(
                'text-sm font-medium',
                active ? 'text-primary-foreground' : 'text-foreground'
              )}
            >
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <Screen maxWidth="max-w-2xl">
      <ScreenHeader title="Settings" description="Personalize the app and manage your account." />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how the app looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearancePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Sign-in and profile management arrive with accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Text variant="muted">Connect your Google account to scout, take assignments, and get notified.</Text>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="gap-1">
          <Text variant="muted">Gentoo · FTC Team Hub</Text>
          <Text variant="muted">Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </CardContent>
      </Card>
    </Screen>
  );
}
