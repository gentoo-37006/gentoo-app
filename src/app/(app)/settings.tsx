import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { WhatsNewModal } from '@/components/whats-new';
import { APP_VERSION } from '@/lib/app-version';
import { useAuth } from '@/lib/auth';
import { useDesktopUpdates } from '@/lib/desktop-updates';
import { timeAgo } from '@/lib/format';
import { useSyncFTCScout } from '@/lib/queries/ftcscout';
import { ACTIVE_EVENT_KEY, useAppSetting } from '@/lib/queries/settings';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/lib/theme-mode';
import { cn } from '@/lib/utils';
import { Download, LogOut, Moon, RefreshCw, Sparkles, Sun, SunMoon, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';

type Mode = 'light' | 'dark' | 'system';
const MODES: { value: Mode; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: SunMoon },
];

function AppearancePicker() {
  const { mode, setMode } = useThemeMode();

  return (
    <View className="flex-row gap-2">
      {MODES.map((m) => {
        const active = mode === m.value;
        return (
          <Pressable
            key={m.value}
            onPress={() => setMode(m.value)}
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

function AccountCard() {
  const { profile, signOut } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <View className="flex-row items-center gap-3">
          <Avatar name={profile?.full_name} uri={profile?.avatar_url} size={48} />
          <View className="flex-1">
            <Text className="font-semibold" numberOfLines={1}>
              {profile?.full_name ?? 'Member'}
            </Text>
            {profile?.email ? (
              <Text variant="small" numberOfLines={1}>
                {profile.email}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Badge variant={profile?.role === 'admin' ? 'default' : 'muted'} label={profile?.role ?? 'member'} />
          {(profile?.functional_roles ?? []).map((r) => (
            <Badge key={r} variant="secondary" label={r} />
          ))}
        </View>
        <Text variant="muted">If linked, a role will automatically be assigned.</Text>
        <Button variant="outline" label="Sign out" icon={LogOut} onPress={signOut} />
      </CardContent>
    </Card>
  );
}

function FTCScoutSyncCard() {
  const syncFTC = useSyncFTCScout();
  const { data: setting } = useAppSetting(ACTIVE_EVENT_KEY);

  const savedEventCode = (setting?.value?.eventCode as string) ?? '';

  // Initialize state from the already-loaded setting value when this component first mounts.
  // Using a function initializer avoids any effect or ref.
  const [eventCode, setEventCode] = React.useState(() => savedEventCode);

  // if (profile?.role !== 'admin') return null;

  const lastSynced = setting?.value?.last_synced
    ? timeAgo(setting.value.last_synced as string)
    : 'Never';

  const handleSync = () => {
    if (!eventCode.trim()) {
      Alert.alert('Error', 'Please enter an event code.');
      return;
    }

    syncFTC.mutate(eventCode.trim(), {
      onSuccess: () => {
        Alert.alert('Success', 'Event data synced from FTC Scout.');
      },
      onError: (err) => {
        Alert.alert('Sync Failed', err.message);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>FTC Scout Integration</CardTitle>
        <CardDescription>Sync match schedules and team lists from api.ftcscout.org</CardDescription>
      </CardHeader>
      <CardContent className="gap-4">
        <View>
          <Text className="mb-2 font-medium">Event Code</Text>
          <Input 
            placeholder="e.g. CAONCMP"
            value={eventCode}
            onChangeText={setEventCode}
            editable={!syncFTC.isPending}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View className="flex-row items-center gap-3">
          <Button 
            label="Sync Event Data" 
            icon={Download} 
            loading={syncFTC.isPending} 
            onPress={handleSync} 
          />
          <Text variant="small">Last synced: {lastSynced}</Text>
        </View>
      </CardContent>
    </Card>
  );
}

function DiscordCard() {
  const { profile, refreshProfile, isDemo } = useAuth();
  const [code, setCode] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [unlinking, setUnlinking] = React.useState(false);
  const isLinked = !!profile?.discord_id;

  async function generateCode() {
    if (!profile) return;
    if (isDemo) {
      setCode('123456');
      return;
    }
    setGenerating(true);
    await supabase.from('discord_link_tokens').delete().eq('user_id', profile.id).is('used_at', null);
    const { data, error } = await supabase
      .from('discord_link_tokens')
      .insert({ user_id: profile.id })
      .select('token')
      .single();
    if (error) {
      console.error('[discord] generateCode error:', error);
      Alert.alert('Error', error.message ?? 'Could not generate a link code. Please try again.');
    } else if (data) {
      setCode((data as { token: string }).token);
    }
    setGenerating(false);
  }

  async function unlink() {
    if (!profile) return;
    if (isDemo) return;
    setUnlinking(true);
    await supabase.from('profiles').update({ discord_id: null }).eq('id', profile.id);
    await refreshProfile();
    setUnlinking(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discord</CardTitle>
        <CardDescription>
          {isLinked
            ? 'Your account is linked. Use /me, /done, and /task in Discord.'
            : 'Link your Discord account to use bot commands in your server.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        {isLinked ? (
          <Button variant="outline" label="Unlink Discord" loading={unlinking} onPress={unlink} />
        ) : code ? (
          <>
            <View className="items-center rounded-lg bg-muted px-4 py-5">
              <Text className="font-mono text-3xl font-bold tracking-[0.25em]">{code}</Text>
            </View>
            <Text variant="muted" className="text-center text-sm">
              {'Run '}
              <Text className="font-mono font-semibold">/link {code}</Text>
              {' in Discord · expires in 15 min'}
            </Text>
            <Button variant="outline" label="Refresh status" onPress={async () => { await refreshProfile(); }} />
          </>
        ) : (
          <Button label="Get Link Code" loading={generating} onPress={generateCode} />
        )}
      </CardContent>
    </Card>
  );
}

/** Desktop-only: manual update check + restart-to-install, driven by the
 *  Electron shell's auto-updater (see src/lib/desktop-updates.ts). */
function DesktopUpdates() {
  const { isDesktop, status, check, install } = useDesktopUpdates();
  if (!isDesktop || status?.state === 'unsupported') return null;

  const state = status?.state ?? 'idle';
  const detail =
    state === 'checking'
      ? 'Checking for updates…'
      : state === 'downloading'
        ? `Downloading update${status?.next ? ` v${status.next}` : ''}… ${status?.percent ?? 0}%`
        : state === 'downloaded'
          ? `Update ready${status?.next ? ` (v${status.next})` : ''} — restart to install.`
          : state === 'up-to-date'
            ? 'You’re up to date.'
            : state === 'error'
              ? `Update check failed: ${status?.message ?? 'unknown error'}`
              : null;

  return (
    <View className="gap-2 pt-2">
      {detail ? (
        <Text variant="small" className="text-muted-foreground">
          {detail}
        </Text>
      ) : null}
      {state === 'downloaded' ? (
        <Button size="sm" label="Restart to update" icon={RefreshCw} onPress={install} />
      ) : (
        <Button
          variant="outline"
          size="sm"
          label="Check for updates"
          icon={RefreshCw}
          loading={state === 'checking'}
          disabled={state === 'checking' || state === 'downloading'}
          onPress={check}
        />
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const [whatsNewOpen, setWhatsNewOpen] = React.useState(false);

  return (
    <Screen maxWidth="max-w-2xl">
      <ScreenHeader title="Settings" description="Personalize the app and manage your account." />

      <FTCScoutSyncCard />

      <AccountCard />

      <DiscordCard />

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
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="gap-1">
          <Text variant="muted">© 2026 Gentoo Robotics. All rights reserved.</Text>
          <Text variant="muted">Yan, Radean, Max, and Ethan</Text>
          <Text variant="muted">Version {APP_VERSION}</Text>
          <View className="pt-2">
            <Button
              variant="outline"
              size="sm"
              label="What’s new"
              icon={Sparkles}
              onPress={() => setWhatsNewOpen(true)}
            />
          </View>
          <DesktopUpdates />
          <WhatsNewModal visible={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
        </CardContent>
      </Card>
    </Screen>
  );
}
