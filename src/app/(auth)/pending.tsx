import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, RefreshCw, LogOut, WifiOff } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { ConfirmationButton } from '@/components/ui/delete-button';
import { AccountDeletionButton } from '@/components/account-deletion-button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthScreenActions } from '@/components/theme-toggle-button';
import { usePreventNonInputSelection } from '@/lib/use-prevent-non-input-selection';

export default function PendingScreen() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const rejected = profile?.status === 'rejected';
  // The gate also sends people here when the profile could not be loaded at all
  // (see _layout.tsx) — better than the endless splash that used to happen, but
  // telling them an admin is reviewing their account would be a fiction.
  const unavailable = !profile;
  usePreventNonInputSelection();

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 select-none bg-background">
      <View className="items-end px-4 pt-4">
        <AuthScreenActions />
      </View>
      {/* Fixed and centred, this card clips on a short viewport (landscape
          phone, split-screen iPad) and takes "Delete my account" off-screen with
          it — the one control App Review has to reach here (guideline 5.1.1(v)). */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-sm gap-6">
          <Card>
            <CardContent className="items-center gap-4 px-6 py-10">
              <View
                className={`h-16 w-16 items-center justify-center rounded-md ${
                  rejected ? 'bg-destructive/15' : 'bg-warning/15'
                }`}
              >
                <Icon
                  as={unavailable ? WifiOff : Clock}
                  size={30}
                  className={rejected ? 'text-destructive' : 'text-warning'}
                />
              </View>
              <View className="items-center gap-1">
                <Text variant="h3" className="text-center">
                  {rejected
                    ? 'Access not granted'
                    : unavailable
                      ? 'Couldn’t load your account'
                      : 'Awaiting approval'}
                </Text>
                <Text variant="muted" className="text-center">
                  {rejected
                    ? 'An administrator has declined your request. Reach out to your team lead if this is a mistake.'
                    : unavailable
                      ? 'We couldn’t reach the server to check your account. Check your connection and try again.'
                      : `Hi ${profile?.full_name ?? 'there'} — your account is waiting for an admin to approve it. You’ll get in as soon as they do.`}
                </Text>
              </View>

              {!rejected && (
                <Button
                  variant="outline"
                  label="Check again"
                  icon={RefreshCw}
                  loading={refreshing}
                  onPress={onRefresh}
                  className="w-full"
                />
              )}
            </CardContent>
          </Card>

          <ConfirmationButton
            variant="ghost"
            label="Sign out"
            icon={LogOut}
            confirmationAction="sign out"
            onPress={signOut}
          />
          <AccountDeletionButton className="w-full" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
