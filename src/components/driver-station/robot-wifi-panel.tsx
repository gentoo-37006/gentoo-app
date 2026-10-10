import * as React from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Save, Trash2, Wifi, X } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { connectRobotWifi, forgetRobotWifi, readRobotWifi, saveRobotWifi } from '@/lib/driver-station/wifi';
import { openDriverStationWifiSettings } from '../../../modules/gentoo-driver-station';

export function RobotWifiPanel({ canConnect, onClose }: { canConnect: boolean; onClose: () => void }) {
  const [ssid, setSsid] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [settingsRequired, setSettingsRequired] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void readRobotWifi().then((saved) => {
      if (active && saved) { setSsid(saved.ssid); setPassword(saved.password); }
    }).catch(() => { if (active) setMessage('Could not read saved Wi-Fi settings.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const run = async (task: () => Promise<void>) => {
    setBusy(true); setMessage(null); setSettingsRequired(false);
    try { await task(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Wi-Fi request failed.'); }
    finally { setBusy(false); }
  };
  return (
      <View className="flex-1 items-center p-4">
        <View className="w-full max-w-lg flex-1">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold">Robot Wi-Fi</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close Robot Wi-Fi" className="h-10 w-10 items-center justify-center" onPress={onClose}><Icon as={X} size={20} className="text-foreground" /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-1 text-xs font-semibold">Network name (SSID)</Text>
            <TextInput accessibilityLabel="Robot network name" value={ssid} onChangeText={setSsid} editable={!busy} autoCapitalize="none" autoCorrect={false} className="mb-3 h-11 rounded-sm border border-input px-3 text-sm text-foreground" />
            <Text className="mb-1 text-xs font-semibold">Password</Text>
            <TextInput accessibilityLabel="Robot network password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} className="mb-3 h-11 rounded-sm border border-input px-3 text-sm text-foreground" />
            {!canConnect ? <Text className="mb-3 text-xs text-warning-foreground">An OpMode is active. Network changes are unavailable.</Text> : null}
            {message ? <Text className="mb-3 text-xs" selectable>{message}</Text> : null}
            {settingsRequired ? <Button variant="outline" className="mb-3" onPress={() => void openDriverStationWifiSettings().catch(() => setMessage('Could not open Settings.'))}><Text>{Platform.OS === 'ios' ? 'Open Settings' : 'Open Wi-Fi Settings'}</Text></Button> : null}
            <View className="flex-row flex-wrap gap-2">
              <Button disabled={busy || !canConnect} onPress={() => void run(async () => {
                const settings = { ssid, password };
                await saveRobotWifi(settings);
                const result = await connectRobotWifi(settings);
                setSettingsRequired(result === 'settings-required');
                setMessage(result === 'settings-required'
                  ? `This build cannot join Wi-Fi directly. Select ${ssid} in the phone's Wi-Fi settings.`
                  : 'Wi-Fi join requested. Waiting for the Control Hub.');
              })}><Icon as={Wifi} size={17} className="text-primary-foreground" /><Text>{busy ? 'Working...' : 'Save & connect'}</Text></Button>
              <Button variant="outline" disabled={busy} onPress={() => void run(async () => { await saveRobotWifi({ ssid, password }); setMessage('Network saved.'); })}><Icon as={Save} size={17} className="text-foreground" /><Text>Save</Text></Button>
              <Button variant="outline" disabled={busy} onPress={() => void run(async () => { await forgetRobotWifi(); setSsid(''); setPassword(''); setMessage('Saved credentials removed from Gentoo.'); })}><Icon as={Trash2} size={17} className="text-foreground" /><Text>Forget</Text></Button>
            </View>
          </ScrollView>
        </View>
      </View>
  );
}
